package com.ecricketcoach.mobile.presentation.auth

import android.util.Log
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import androidx.credentials.exceptions.GetCredentialCancellationException
import androidx.credentials.exceptions.GetCredentialException
import com.ecricketcoach.mobile.domain.model.CoachUser
import com.ecricketcoach.mobile.domain.model.GoogleSignInChallenge
import com.ecricketcoach.mobile.domain.repository.AuthRepository
import com.ecricketcoach.mobile.domain.usecase.CompleteOAuthCallbackUseCase
import com.ecricketcoach.mobile.domain.usecase.GetSignInProvidersUseCase
import com.ecricketcoach.mobile.domain.usecase.SignInWithGoogleUseCase
import com.ecricketcoach.mobile.domain.usecase.SignOutUseCase
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch

/** Sign-in providers, sign-in/sign-out flows and the current session. */
@HiltViewModel
class AuthViewModel @Inject constructor(
    private val auth: AuthRepository,
    private val getProviders: GetSignInProvidersUseCase,
    private val signInWithGoogle: SignInWithGoogleUseCase,
    private val completeOAuthCallback: CompleteOAuthCallbackUseCase,
    private val signOutUseCase: SignOutUseCase
) : ViewModel() {
    val currentUser: StateFlow<CoachUser?> = auth.currentUser
    val mobileCallbackUrl: String get() = auth.mobileCallbackUrl

    var providers by mutableStateOf<Map<String, Boolean>>(emptyMap())
        private set
    var error by mutableStateOf("")
    var signingIn by mutableStateOf(false)
        private set

    init {
        viewModelScope.launch {
            try {
                providers = getProviders()
            } catch (failure: CancellationException) {
                throw failure
            } catch (failure: Exception) {
                error = failure.message ?: "Unable to connect to eCricketCoach."
            }
        }
    }

    fun signInUrl(provider: String): String = auth.signInUrl(provider)

    /**
     * Runs a sign-in. For Google, [obtainGoogleIdToken] shows the platform credential prompt; other
     * providers are handed to [openBrowser] and complete through the OAuth callback deep link.
     */
    fun signIn(
        provider: String,
        obtainGoogleIdToken: suspend (GoogleSignInChallenge) -> String,
        openBrowser: (String) -> Unit
    ) {
        viewModelScope.launch {
            signingIn = true
            error = ""
            try {
                if (provider == "google") signInWithGoogle(obtainGoogleIdToken)
                else openBrowser(auth.signInUrl(provider))
            } catch (failure: GetCredentialCancellationException) {
                Log.w("eCricketCoach", "Google Credential Manager sign-in was cancelled (${failure.message}).")
                error = "Google sign-in was dismissed or unavailable. Add a Google account to this device and verify the Android OAuth client uses package com.ecricketcoach.mobile with SHA-1 6B:6B:F6:7E:EC:D5:1B:E8:A0:E7:99:AA:C6:E5:D5:5E:73:90:B5:93."
            } catch (failure: CancellationException) {
                throw failure
            } catch (failure: GetCredentialException) {
                Log.w("eCricketCoach", "Native Google sign-in failed (${failure.type}).")
                error = "Google sign-in failed. Check that a Google account is available and the Android OAuth client matches this app's signing certificate."
            } catch (failure: Exception) {
                Log.w("eCricketCoach", "Unable to complete sign-in (${failure.javaClass.simpleName}).")
                error = failure.message ?: "Unable to complete sign-in."
            } finally {
                signingIn = false
            }
        }
    }

    fun completeCallback(parameters: Map<String, String?>) {
        if (!completeOAuthCallback(parameters)) {
            Log.w("eCricketCoach", "Rejected an incomplete or unsupported sign-in callback.")
        }
    }

    /** Ends the session after the server rejected the stored token. */
    fun expireSession(message: String) {
        signOutUseCase()
        error = message
    }

    fun signOut(clearCredentialState: suspend () -> Unit) {
        viewModelScope.launch {
            signOutUseCase()
            error = ""
            try {
                clearCredentialState()
            } catch (failure: CancellationException) {
                throw failure
            } catch (failure: Exception) {
                Log.w("eCricketCoach", "Unable to clear credential state (${failure.javaClass.simpleName}).")
                error = "Signed out locally, but Google account selection could not be reset. Please try again."
            }
        }
    }
}
