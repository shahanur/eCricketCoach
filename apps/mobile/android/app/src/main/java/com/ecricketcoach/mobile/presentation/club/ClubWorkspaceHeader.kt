package com.ecricketcoach.mobile.presentation.club

import com.ecricketcoach.mobile.presentation.common.theme.AppFontSize
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.ecricketcoach.mobile.domain.model.ClubTrainingSession
import com.ecricketcoach.mobile.domain.model.CoachUser
import com.ecricketcoach.mobile.domain.model.PlayerAssessment
import com.ecricketcoach.mobile.presentation.common.AppHeader
import com.ecricketcoach.mobile.presentation.common.HeaderBackButton
import com.ecricketcoach.mobile.presentation.common.HeaderGreetingTitle
import com.ecricketcoach.mobile.presentation.common.HeaderPageTitle
import com.ecricketcoach.mobile.presentation.common.theme.WorkspaceColors
import com.ecricketcoach.mobile.presentation.common.timeOfDayGreeting

/** Club workspace header: maps the current tab / active session / assessment onto the shared [AppHeader]. */
@Composable
internal fun ClubWorkspaceHeader(
    tab: String,
    user: CoachUser,
    isDark: Boolean,
    onToggleTheme: () -> Unit,
    onSignOut: () -> Unit,
    activeSession: ClubTrainingSession? = null,
    activeAssessment: PlayerAssessment? = null,
    onAssessmentBack: () -> Unit = {},
    activeSessionPageTitle: String? = null,
    onSessionBack: (() -> Unit)? = null
) {
    MaterialTheme(colorScheme = WorkspaceColors) {
        val isOverview = tab == "Overview"
        AppHeader(
            isDark = isDark,
            onToggleTheme = onToggleTheme,
            onSignOut = onSignOut,
            clubName = user.clubName ?: "Ekota Academy",
            greeting = timeOfDayGreeting().takeIf { isOverview && activeSession == null }
        ) {
            when {
                activeSession != null -> ActiveSessionTitle(activeSession, activeSessionPageTitle) { onSessionBack?.invoke() }
                activeAssessment != null -> ActiveAssessmentTitle(activeAssessment, onAssessmentBack)
                isOverview -> HeaderGreetingTitle(user.name, "Let’s plan, coach and grow together.")
                else -> HeaderPageTitle(workspaceTabIcon(pageIconLabel(tab)), pageTitle(tab), pageDescription(tab))
            }
        }
    }
}

@Composable
private fun ActiveSessionTitle(session: ClubTrainingSession, pageTitle: String?, onBack: () -> Unit) {
    val scheme = MaterialTheme.colorScheme
    Row(verticalAlignment = Alignment.CenterVertically) {
        HeaderBackButton(onBack)
        Column(Modifier.weight(1f).padding(start = 8.dp), verticalArrangement = Arrangement.spacedBy(3.dp)) {
            Text(
                pageTitle ?: session.title,
                color = scheme.onSurface,
                fontSize = AppFontSize.Headline,
                fontWeight = FontWeight.ExtraBold,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
            val details = "${session.sessionDate}  ·  ${session.durationMinutes} min  ·  ${session.squadName}"
            Text(
                if (pageTitle != null) "${session.title}  ·  $details" else details,
                color = scheme.onSurfaceVariant,
                fontSize = AppFontSize.Small,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis
            )
        }
    }
}

@Composable
private fun ActiveAssessmentTitle(assessment: PlayerAssessment, onBack: () -> Unit) {
    val scheme = MaterialTheme.colorScheme
    Row(verticalAlignment = Alignment.CenterVertically) {
        HeaderBackButton(onBack, contentDescription = "Back to assessments")
        Column(Modifier.weight(1f).padding(start = 8.dp), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(
                "${assessment.playerName} · ${assessment.discipline}".uppercase(),
                color = scheme.primary,
                fontSize = AppFontSize.Body,
                fontWeight = FontWeight.SemiBold,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                Text(
                    assessment.title,
                    color = scheme.onSurface,
                    fontSize = AppFontSize.Headline,
                    fontWeight = FontWeight.ExtraBold,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.weight(1f, fill = false)
                )
                Text(
                    assessment.status.replace('_', ' '),
                    color = scheme.primary,
                    fontSize = AppFontSize.Small,
                    fontWeight = FontWeight.SemiBold,
                    modifier = Modifier
                        .background(scheme.primary.copy(alpha = 0.12f), RoundedCornerShape(50))
                        .padding(horizontal = 10.dp, vertical = 4.dp)
                )
            }
            Text(
                assessment.scheduledDate +
                    (assessment.scheduledTime?.let { " at $it" } ?: "") +
                    (assessment.coachName.takeIf(String::isNotBlank)?.let { " · Coach $it" } ?: ""),
                color = scheme.onSurfaceVariant,
                fontSize = AppFontSize.Body,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
        }
    }
}

private fun pageTitle(tab: String) = when (tab) {
    "Sessions", "Edit session", "Schedule session" -> "Training Sessions"
    "Assessments", "Edit assessment", "Assessment" -> "Player Assessments"
    "Edit squad" -> "Squads"
    "Delivered sessions" -> "Delivered Sessions"
    else -> tab
}

private fun pageIconLabel(tab: String) = when (tab) {
    "Sessions", "Edit session", "Schedule session", "Delivered sessions" -> "Sessions"
    "Assessments", "Edit assessment", "Assessment" -> "Assessments"
    "Edit squad" -> "Squads"
    "Participants" -> "Members"
    else -> tab
}

private fun pageDescription(tab: String) = when (tab) {
    "Video Analysis" -> "Pick any player and review their batting technique from a video."
    "Members" -> "Manage club staff and players."
    "Squads", "Edit squad" -> "Organize players into squads and track their development."
    "Sessions" -> "Plan, deliver and track coaching sessions."
    "Edit session" -> "Update session details, drills and squad assignments."
    "Schedule session" -> "Plan a training session for your squad."
    "Assessments" -> "Track player progress and development."
    "Edit assessment" -> "Update assessment details and evaluation criteria."
    "Assessment" -> "Review and complete this player assessment."
    "Reports" -> "Review club activity, participation and player progress."
    "Certificates" -> "Manage player achievements and certificates."
    "Drills", "Club drills" -> "Browse and manage coaching drills."
    "Templates" -> "Create and manage reusable training plans."
    "Progression" -> "Review player development and progression."
    "Settings" -> "Manage your club settings and branding."
    "Delivered sessions" -> "Review completed sessions and coaching outcomes."
    "Participants" -> "Review participants in the selected session."
    else -> "Manage your club workspace."
}
