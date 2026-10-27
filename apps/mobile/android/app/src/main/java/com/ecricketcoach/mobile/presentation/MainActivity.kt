package com.ecricketcoach.mobile.presentation

import android.content.Intent
import android.net.Uri
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.viewModels
import androidx.browser.customtabs.CustomTabsIntent
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.credentials.ClearCredentialStateRequest
import androidx.credentials.CredentialManager
import androidx.credentials.CustomCredential
import androidx.credentials.GetCredentialRequest
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.ecricketcoach.mobile.domain.model.GoogleSignInChallenge
import com.ecricketcoach.mobile.domain.usecase.usesClubWorkspace
import com.ecricketcoach.mobile.presentation.auth.AuthViewModel
import com.ecricketcoach.mobile.presentation.auth.SignInScreen
import com.ecricketcoach.mobile.presentation.club.ClubCoachWorkspace
import com.ecricketcoach.mobile.presentation.common.theme.ECricketCoachTheme
import com.ecricketcoach.mobile.presentation.home.HomeScreen
import com.ecricketcoach.mobile.presentation.home.HomeViewModel
import com.google.android.libraries.identity.googleid.GetSignInWithGoogleOption
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential
import dagger.hilt.android.AndroidEntryPoint

@AndroidEntryPoint
class MainActivity : ComponentActivity() {
    private val authViewModel: AuthViewModel by viewModels()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        handleCallback(intent)
        setContent {
            CoachApp(
                authViewModel = authViewModel,
                obtainGoogleIdToken = ::obtainGoogleIdToken,
                openBrowser = { url -> CustomTabsIntent.Builder().build().launchUrl(this, Uri.parse(url)) },
                clearCredentialState = {
                    CredentialManager.create(this).clearCredentialState(ClearCredentialStateRequest())
                }
            )
        }
    }

    /** Shows the platform Google account picker bound to the server-issued nonce. */
    private suspend fun obtainGoogleIdToken(challenge: GoogleSignInChallenge): String {
        val option = GetSignInWithGoogleOption.Builder(challenge.clientId)
            .setNonce(challenge.nonce)
            .build()
        val result = CredentialManager.create(this).getCredential(
            context = this,
            request = GetCredentialRequest.Builder().addCredentialOption(option).build()
        )
        val credential = result.credential
        require(credential is CustomCredential &&
            credential.type == GoogleIdTokenCredential.TYPE_GOOGLE_ID_TOKEN_CREDENTIAL) {
            "Google returned an unsupported credential."
        }
        return GoogleIdTokenCredential.createFrom(credential.data).idToken
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        handleCallback(intent)
    }

    private fun handleCallback(intent: Intent?) {
        val uri = intent?.data ?: return
        if (uri.toString().substringBefore('#') != authViewModel.mobileCallbackUrl) return
        val callbackQuery = Uri.parse("https://callback.invalid/?${uri.fragment.orEmpty()}")
        val parameters = callbackQuery.queryParameterNames.associateWith { callbackQuery.getQueryParameter(it) }
        authViewModel.completeCallback(parameters)
    }
}

@Composable
private fun CoachApp(
    authViewModel: AuthViewModel,
    obtainGoogleIdToken: suspend (GoogleSignInChallenge) -> String,
    openBrowser: (String) -> Unit,
    clearCredentialState: suspend () -> Unit,
    homeViewModel: HomeViewModel = hiltViewModel()
) {
    val user by authViewModel.currentUser.collectAsStateWithLifecycle()
    var isDark by remember { mutableStateOf(true) }
    val signOut = { authViewModel.signOut(clearCredentialState) }

    LaunchedEffect(user?.id, user?.tenantId, user?.role) {
        homeViewModel.bind(user)
        if (user != null) homeViewModel.synchronize(authViewModel::expireSession)
    }

    ECricketCoachTheme(isDark) {
        Surface(
            modifier = Modifier.fillMaxSize().windowInsetsPadding(WindowInsets.safeDrawing),
            color = MaterialTheme.colorScheme.background
        ) {
            val activeUser = user
            when {
                activeUser == null -> SignInScreen(
                    providers = authViewModel.providers,
                    error = authViewModel.error,
                    signingIn = authViewModel.signingIn,
                    isDark = isDark,
                    onToggleTheme = { isDark = !isDark },
                    onSignIn = { provider -> authViewModel.signIn(provider, obtainGoogleIdToken, openBrowser) }
                )
                activeUser.usesClubWorkspace() -> ClubCoachWorkspace(
                    user = activeUser,
                    drills = homeViewModel.drills,
                    templates = homeViewModel.templates,
                    isDark = isDark,
                    onToggleTheme = { isDark = !isDark },
                    onSignOut = signOut
                )
                else -> HomeScreen(
                    user = activeUser,
                    drills = homeViewModel.drills,
                    templates = homeViewModel.templates,
                    refreshing = homeViewModel.refreshing,
                    offline = homeViewModel.offline,
                    error = homeViewModel.error,
                    isDark = isDark,
                    onToggleTheme = { isDark = !isDark },
                    onSync = { homeViewModel.synchronize(authViewModel::expireSession) },
                    onSignOut = signOut
                )
            }
        }
    }
}
