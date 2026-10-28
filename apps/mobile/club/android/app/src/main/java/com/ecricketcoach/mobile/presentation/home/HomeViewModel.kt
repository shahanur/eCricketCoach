package com.ecricketcoach.mobile.presentation.home

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.ecricketcoach.mobile.domain.model.ApiException
import com.ecricketcoach.mobile.domain.model.CoachUser
import com.ecricketcoach.mobile.domain.model.Drill
import com.ecricketcoach.mobile.domain.model.TrainingTemplate
import com.ecricketcoach.mobile.domain.usecase.SyncTrainingContentUseCase
import com.ecricketcoach.mobile.domain.usecase.TrainingContent
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.launch

/** Cached drills and templates for the signed-in user, refreshed from the server. */
@HiltViewModel
class HomeViewModel @Inject constructor(
    private val syncTrainingContent: SyncTrainingContentUseCase
) : ViewModel() {
    private var user: CoachUser? = null

    var drills by mutableStateOf<List<Drill>>(emptyList())
        private set
    var templates by mutableStateOf<List<TrainingTemplate>>(emptyList())
        private set
    var refreshing by mutableStateOf(false)
        private set
    var offline by mutableStateOf(false)
        private set
    var error by mutableStateOf("")
        private set

    /** Loads the cached content for [user] (or clears it on sign-out). */
    fun bind(user: CoachUser?) {
        this.user = user
        val cached = syncTrainingContent.cached(user)
        drills = cached.drills
        templates = cached.templates
        offline = false
        error = ""
    }

    fun synchronize(onSessionExpired: (String) -> Unit) {
        val activeUser = user ?: return
        viewModelScope.launch {
            refreshing = true
            error = ""
            try {
                val latest = syncTrainingContent(activeUser, TrainingContent(drills, templates))
                drills = latest.drills
                templates = latest.templates
                offline = false
            } catch (failure: CancellationException) {
                throw failure
            } catch (failure: Exception) {
                offline = drills.isNotEmpty() || templates.isNotEmpty()
                val message = failure.message ?: "Unable to synchronize training data."
                error = message
                if (failure is ApiException && failure.statusCode == 401) onSessionExpired(message)
            } finally {
                refreshing = false
            }
        }
    }
}
