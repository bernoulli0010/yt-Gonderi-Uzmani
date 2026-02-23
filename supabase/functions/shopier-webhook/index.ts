import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

// Shopier Product ID -> Token amount mapping
const PRODUCT_TOKEN_MAP: Record<string, number> = {
  "44335263": 100,   // 100 Token - 100 TL
  "44335254": 500,   // 500 Token - 400 TL
  "44335234": 1000,  // 1000 Token - 750 TL
}

serve(async (req: Request) => {
  // Only accept POST requests
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    })
  }

  try {
    // Read headers
    const shopierEvent = req.headers.get("Shopier-Event")
    const shopierWebhookId = req.headers.get("Shopier-Webhook-Id")
    const shopierSignature = req.headers.get("Shopier-Signature")
    const shopierAccountId = req.headers.get("Shopier-Account-Id")

    console.log(`[Shopier Webhook] Event: ${shopierEvent}, WebhookId: ${shopierWebhookId}, AccountId: ${shopierAccountId}`)

    // Only process order.created events
    if (shopierEvent !== "order.created") {
      console.log(`[Shopier Webhook] Ignoring event: ${shopierEvent}`)
      return new Response(JSON.stringify({ ok: true, message: "Event ignored" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    }

    // Parse the order payload
    const order = await req.json()
    console.log(`[Shopier Webhook] Order ID: ${order.id}, Status: ${order.paymentStatus}`)

    // Only process paid orders
    if (order.paymentStatus !== "paid") {
      console.log(`[Shopier Webhook] Order not paid, ignoring`)
      return new Response(JSON.stringify({ ok: true, message: "Order not paid" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    }

    // Get the user's app email from the order note (customNote field)
    const appEmail = (order.note || "").trim().toLowerCase()
    if (!appEmail || !appEmail.includes("@")) {
      console.error(`[Shopier Webhook] Invalid or missing app email in order note: "${order.note}"`)
      // Still return 200 to prevent retries - we'll handle manually
      return new Response(JSON.stringify({ ok: false, error: "Invalid app email in order note" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    }

    // Calculate total tokens from line items
    let totalTokens = 0
    const lineItems = order.lineItems || []
    for (const item of lineItems) {
      const productId = item.productId
      const quantity = item.quantity || 1
      const tokenAmount = PRODUCT_TOKEN_MAP[productId]
      if (tokenAmount) {
        totalTokens += tokenAmount * quantity
      }
    }

    if (totalTokens === 0) {
      console.error(`[Shopier Webhook] No matching token products found in order. Line items: ${JSON.stringify(lineItems)}`)
      return new Response(JSON.stringify({ ok: false, error: "No token products found" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    }

    console.log(`[Shopier Webhook] Adding ${totalTokens} tokens to user: ${appEmail}`)

    // Initialize Supabase client with service role key (bypasses RLS)
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Check for duplicate webhook (idempotency using order ID)
    const { data: existingPurchase } = await supabase
      .from("token_purchases")
      .select("id")
      .eq("shopier_order_id", order.id)
      .single()

    if (existingPurchase) {
      console.log(`[Shopier Webhook] Duplicate webhook for order ${order.id}, skipping`)
      return new Response(JSON.stringify({ ok: true, message: "Already processed" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    }

    // Find user by email
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, token_balance")
      .eq("email", appEmail)
      .single()

    if (profileError || !profile) {
      console.error(`[Shopier Webhook] User not found for email: ${appEmail}`, profileError)
      // Log the failed purchase attempt for manual resolution
      await supabase.from("token_purchases").insert({
        shopier_order_id: order.id,
        shopier_webhook_id: shopierWebhookId,
        email: appEmail,
        tokens: totalTokens,
        amount: order.totals?.total || "0",
        currency: order.currency || "TRY",
        status: "failed",
        error_message: `User not found for email: ${appEmail}`,
        raw_payload: order,
      })
      return new Response(JSON.stringify({ ok: false, error: "User not found" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    }

    // Update token balance
    const newBalance = (profile.token_balance || 0) + totalTokens
    const { error: updateError } = await supabase
      .from("profiles")
      .update({ token_balance: newBalance })
      .eq("id", profile.id)

    if (updateError) {
      console.error(`[Shopier Webhook] Failed to update token balance:`, updateError)
      await supabase.from("token_purchases").insert({
        shopier_order_id: order.id,
        shopier_webhook_id: shopierWebhookId,
        user_id: profile.id,
        email: appEmail,
        tokens: totalTokens,
        amount: order.totals?.total || "0",
        currency: order.currency || "TRY",
        status: "failed",
        error_message: `DB update failed: ${updateError.message}`,
        raw_payload: order,
      })
      return new Response(JSON.stringify({ ok: false, error: "Failed to update balance" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    }

    // Log successful purchase
    await supabase.from("token_purchases").insert({
      shopier_order_id: order.id,
      shopier_webhook_id: shopierWebhookId,
      user_id: profile.id,
      email: appEmail,
      tokens: totalTokens,
      amount: order.totals?.total || "0",
      currency: order.currency || "TRY",
      status: "success",
      raw_payload: order,
    })

    console.log(`[Shopier Webhook] Success! User ${appEmail} now has ${newBalance} tokens (+${totalTokens})`)

    return new Response(JSON.stringify({
      ok: true,
      message: `Added ${totalTokens} tokens to ${appEmail}`,
      newBalance,
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })

  } catch (err) {
    console.error(`[Shopier Webhook] Unexpected error:`, err)
    return new Response(JSON.stringify({ ok: false, error: "Internal server error" }), {
      status: 200, // Return 200 to prevent excessive retries
      headers: { "Content-Type": "application/json" },
    })
  }
})
