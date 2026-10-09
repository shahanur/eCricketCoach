package com.ecricketcoach.mobile

import java.net.URI
import java.net.URLDecoder
import org.junit.Assert.assertEquals
import org.junit.Test

class CoachApiTest {
    private val api = CoachApi("http://api.example.test:3000", "https://login.example.test")

    @Test
    fun signInUrlUsesExactMobileCallback() {
        val url = URI(api.signInUrl("google"))

        assertEquals("https", url.scheme)
        assertEquals("login.example.test", url.host)
        assertEquals("/api/auth/google", url.path)
        assertEquals(
            CoachApi.MOBILE_CALLBACK,
            URLDecoder.decode(url.rawQuery.substringAfter("returnTo="), "UTF-8")
        )
    }

    @Test(expected = IllegalArgumentException::class)
    fun signInUrlRejectsUnknownProviders() {
        api.signInUrl("unknown")
    }

    @Test
    fun drillPathEncodesTenantIdAsOneQueryValue() {
        assertEquals(
            "/api/drills?clubId=tenant%26role%3DADMIN",
            api.drillCataloguePath("tenant&role=ADMIN")
        )
    }
}
