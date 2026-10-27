package com.ecricketcoach.mobile.presentation.home

import com.ecricketcoach.mobile.domain.model.*
import com.ecricketcoach.mobile.presentation.common.theme.*
import com.ecricketcoach.mobile.presentation.common.AppHeader
import com.ecricketcoach.mobile.presentation.common.HeaderGreetingTitle
import com.ecricketcoach.mobile.presentation.common.timeOfDayGreeting
import android.util.Log
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowForward
import androidx.compose.material.icons.outlined.Assessment
import androidx.compose.material.icons.outlined.AutoAwesome
import androidx.compose.material.icons.outlined.CalendarMonth
import androidx.compose.material.icons.outlined.DarkMode
import androidx.compose.material.icons.outlined.ErrorOutline
import androidx.compose.material.icons.outlined.LightMode
import androidx.compose.material.icons.outlined.Lock
import androidx.compose.foundation.Image
import androidx.compose.ui.res.painterResource
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.OutlinedButton
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.TextStyle
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.launch
import com.ecricketcoach.mobile.domain.usecase.hasCoachAccess

@androidx.compose.runtime.Composable
internal fun HomeScreen(
    user: CoachUser,
    drills: List<Drill>,
    templates: List<TrainingTemplate>,
    refreshing: Boolean,
    offline: Boolean,
    error: String,
    isDark: Boolean,
    onToggleTheme: () -> Unit,
    onSync: () -> Unit,
    onSignOut: () -> Unit
) {
    var selectedTab by remember { mutableStateOf("Drills") }
    val coachAccess = user.hasCoachAccess()
    Column(Modifier.fillMaxSize().padding(horizontal = 20.dp, vertical = 18.dp)) {
        AppHeader(
            isDark = isDark,
            onToggleTheme = onToggleTheme,
            onSignOut = onSignOut,
            clubName = user.clubName?.takeIf(String::isNotBlank) ?: "eCricketCoach",
            greeting = timeOfDayGreeting()
        ) {
            HeaderGreetingTitle(user.name, "Your drills and training plans.")
        }
        Spacer(Modifier.height(18.dp))
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            TabButton("Drills", drills.size, selectedTab == "Drills") { selectedTab = "Drills" }
            if (coachAccess) {
                TabButton("Templates", templates.size, selectedTab == "Templates") {
                    selectedTab = "Templates"
                }
            }
        }
        if (offline) {
            Spacer(Modifier.height(10.dp))
            Text("Offline · showing your last synchronized data", color = Green, fontSize = AppFontSize.Small)
        }
        if (error.isNotBlank()) {
            Spacer(Modifier.height(8.dp))
            Text(error, color = MaterialTheme.colorScheme.error, fontSize = AppFontSize.Small)
        }
        Spacer(Modifier.height(12.dp))
        if (refreshing && drills.isEmpty() && templates.isEmpty()) {
            Box(Modifier.weight(1f).fillMaxWidth(), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(color = Green)
            }
        } else if (selectedTab == "Templates" && coachAccess) {
            TrainingTemplateList(templates, Modifier.weight(1f))
        } else {
            DrillList(drills, Modifier.weight(1f))
        }
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            TextButton(onClick = onSync, enabled = !refreshing, shape = AppShapes.Button) {
                Text(if (refreshing) "Syncing…" else "Sync now")
            }
        }
    }
}
