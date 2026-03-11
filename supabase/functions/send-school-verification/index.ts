import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const publishableKey = Deno.env.get('SB_PUBLISHABLE_KEY')
    const resendApiKey = Deno.env.get('RESEND_API_KEY')
    const appEnv = Deno.env.get('APP_ENV') ?? 'development'
    const mailFrom = Deno.env.get('MAIL_FROM')

    if (!supabaseUrl || !publishableKey || !resendApiKey || !mailFrom) {
      return new Response(JSON.stringify({ error: 'Missing required secrets' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const token = authHeader.replace('Bearer ', '').trim()
    if (!token) {
      return new Response(JSON.stringify({ error: 'Missing bearer token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 1) Verify JWT inside the function
    const authClient = createClient(supabaseUrl, publishableKey)
    const { data: claimsData, error: claimsError } = await authClient.auth.getClaims(token)

    if (claimsError || !claimsData?.claims?.sub) {
      return new Response(JSON.stringify({ error: 'Invalid JWT' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const body = await req.json()
    const schoolEmail = String(body?.schoolEmail ?? '').trim().toLowerCase()

    if (!schoolEmail) {
      return new Response(JSON.stringify({ error: 'schoolEmail is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 2) Call RPC as the signed-in user so auth.uid() works
    const userClient = createClient(supabaseUrl, publishableKey, {
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
    })

    const { data, error } = await userClient.rpc('request_school_verification', {
      p_school_email: schoolEmail,
    })

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const row = Array.isArray(data) ? data[0] : data
    if (!row) {
      return new Response(JSON.stringify({ error: 'Verification request failed' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const emailPayload = {
      from: mailFrom,
      to: [schoolEmail],
      subject: 'Your school verification code',
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.6;">
          <h2>School Verification</h2>
          <p>Your verification code is:</p>
          <p style="font-size: 28px; font-weight: bold; letter-spacing: 4px;">${row.debug_code}</p>
          <p>This code will expire at: ${row.expires_at}</p>
        </div>
      `,
    }

    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(emailPayload),
    })

    if (!resendResponse.ok) {
      const resendText = await resendResponse.text()

      // IMPORTANT: development fallback
      if (appEnv !== 'production') {
        return new Response(
          JSON.stringify({
            success: true,
            verificationId: row.verification_id,
            universityId: row.university_id,
            universitySlug: row.university_slug,
            schoolEmail: row.school_email,
            expiresAt: row.expires_at,
            debugCode: row.debug_code,
            emailDeliverySkipped: true,
            warning: `Email send failed in development: ${resendText}`,
          }),
          {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          },
        )
      }

      return new Response(JSON.stringify({ error: `Email send failed: ${resendText}` }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(
      JSON.stringify({
        success: true,
        verificationId: row.verification_id,
        universityId: row.university_id,
        universitySlug: row.university_slug,
        schoolEmail: row.school_email,
        expiresAt: row.expires_at,
        ...(appEnv !== 'production' ? { debugCode: row.debug_code } : {}),
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    )
  } catch (err) {
    return new Response(
      JSON.stringify({
        error: err instanceof Error ? err.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    )
  }
})
