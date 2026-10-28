package com.ecricketcoach.player.googleidentity

import android.util.Log
import androidx.credentials.ClearCredentialStateRequest
import androidx.credentials.CredentialManager
import androidx.credentials.CustomCredential
import androidx.credentials.GetCredentialRequest
import androidx.credentials.exceptions.GetCredentialCancellationException
import androidx.credentials.exceptions.GetCredentialException
import androidx.credentials.exceptions.NoCredentialException
import com.google.android.libraries.identity.googleid.GetSignInWithGoogleOption
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.functions.Coroutine
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import kotlinx.coroutines.CancellationException

private const val TAG = "eCricketCoachPlayer"

private class GoogleSignInCancelledException :
  CodedException("ERR_GOOGLE_SIGN_IN_CANCELLED", "Google sign-in was cancelled.", null)

private class GoogleSignInNoCredentialException(cause: Throwable) :
  CodedException("ERR_GOOGLE_SIGN_IN_NO_CREDENTIAL", "No eligible Google account is available.", cause)

private class GoogleSignInUnavailableException :
  CodedException("ERR_GOOGLE_SIGN_IN_UNAVAILABLE", "Google sign-in needs a visible activity.", null)

private class GoogleSignInFailedException(message: String, cause: Throwable?) :
  CodedException("ERR_GOOGLE_SIGN_IN_FAILED", message, cause)

/**
 * Obtains a Google ID token bound to a server-issued nonce through Android Credential Manager.
 * The token is returned to JavaScript only so it can be exchanged with the eCricketCoach API;
 * it is never persisted or logged here.
 */
class GoogleIdentityModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("GoogleIdentity")

    AsyncFunction("getGoogleIdToken") Coroutine { clientId: String, nonce: String ->
      val activity = appContext.currentActivity ?: throw GoogleSignInUnavailableException()
      val option = GetSignInWithGoogleOption.Builder(clientId)
        .setNonce(nonce)
        .build()
      val request = GetCredentialRequest.Builder().addCredentialOption(option).build()
      val credential = try {
        CredentialManager.create(activity).getCredential(activity, request).credential
      } catch (failure: GetCredentialCancellationException) {
        throw GoogleSignInCancelledException()
      } catch (failure: NoCredentialException) {
        Log.w(TAG, "Google sign-in found no eligible credential (${failure.type}).")
        throw GoogleSignInNoCredentialException(failure)
      } catch (failure: CancellationException) {
        throw failure
      } catch (failure: GetCredentialException) {
        Log.w(TAG, "Google sign-in failed (${failure.type}): ${failure.message}")
        throw GoogleSignInFailedException("Google sign-in failed.", failure)
      }
      if (credential !is CustomCredential ||
        credential.type != GoogleIdTokenCredential.TYPE_GOOGLE_ID_TOKEN_CREDENTIAL) {
        throw GoogleSignInFailedException("Google returned an unsupported credential.", null)
      }
      try {
        return@Coroutine GoogleIdTokenCredential.createFrom(credential.data).idToken
      } catch (failure: Exception) {
        throw GoogleSignInFailedException("Google returned an unreadable credential.", failure)
      }
    }

    AsyncFunction("clearCredentialState") Coroutine { ->
      val context = appContext.reactContext ?: return@Coroutine null
      CredentialManager.create(context).clearCredentialState(ClearCredentialStateRequest())
      return@Coroutine null
    }
  }
}
