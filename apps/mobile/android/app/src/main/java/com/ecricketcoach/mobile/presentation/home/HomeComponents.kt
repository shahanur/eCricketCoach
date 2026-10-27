package com.ecricketcoach.mobile.presentation.home

import com.ecricketcoach.mobile.domain.model.*
import com.ecricketcoach.mobile.presentation.common.AppPanel
import com.ecricketcoach.mobile.presentation.common.theme.*
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

@androidx.compose.runtime.Composable
internal fun TabButton(title: String, count: Int, selected: Boolean, onClick: () -> Unit) {
    val background = if (selected) Green else MaterialTheme.colorScheme.surface
    val foreground = if (selected) Color(0xFF092014) else MaterialTheme.colorScheme.onSurface
    Surface(
        modifier = Modifier.clickable(onClick = onClick),
        color = background,
        shape = AppShapes.Medium
    ) {
        Row(Modifier.padding(horizontal = 16.dp, vertical = 11.dp), verticalAlignment = Alignment.CenterVertically) {
            Text(title, color = foreground, fontWeight = FontWeight.SemiBold)
            Spacer(Modifier.width(8.dp))
            Text(count.toString(), color = foreground.copy(alpha = 0.75f), fontSize = AppFontSize.Small)
        }
    }
}

@androidx.compose.runtime.Composable
internal fun DrillList(drills: List<Drill>, modifier: Modifier = Modifier) {
    if (drills.isEmpty()) {
        EmptyState("No drills to show yet", "Sync while online to load the shared drill catalogue.", modifier)
        return
    }
    LazyColumn(modifier = modifier, verticalArrangement = Arrangement.spacedBy(10.dp)) {
        items(drills, key = Drill::id) { drill ->
            ContentCard(
                title = drill.title,
                eyebrow = "${drill.discipline} · ${drill.durationMinutes} min",
                details = listOf(drill.skillSet, drill.instructions).filter(String::isNotBlank).joinToString("\n")
            )
        }
    }
}

@androidx.compose.runtime.Composable
internal fun TrainingTemplateList(templates: List<TrainingTemplate>, modifier: Modifier = Modifier) {
    if (templates.isEmpty()) {
        EmptyState("No templates to show yet", "Shared coaching templates will appear here after a sync.", modifier)
        return
    }
    LazyColumn(modifier = modifier, verticalArrangement = Arrangement.spacedBy(10.dp)) {
        items(templates, key = TrainingTemplate::id) { template ->
            ContentCard(
                title = template.title,
                eyebrow = "${template.durationMinutes} min · ${template.disciplines.joinToString()}",
                details = template.focus
            )
        }
    }
}

@androidx.compose.runtime.Composable
internal fun ContentCard(title: String, eyebrow: String, details: String) {
    AppPanel(modifier = Modifier.fillMaxWidth(), contentPadding = androidx.compose.foundation.layout.PaddingValues(0.dp), spacing = 0.dp) {
        Column(Modifier.padding(16.dp)) {
            Text(eyebrow, color = Green, fontSize = AppFontSize.Caption, fontWeight = FontWeight.Bold)
            Spacer(Modifier.height(5.dp))
            Text(title, fontSize = AppFontSize.BodyLarge, fontWeight = FontWeight.SemiBold)
            if (details.isNotBlank()) {
                Spacer(Modifier.height(6.dp))
                Text(details, color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.72f), fontSize = AppFontSize.Small)
            }
        }
    }
}

@androidx.compose.runtime.Composable
internal fun EmptyState(title: String, detail: String, modifier: Modifier = Modifier) {
    Column(
        modifier = modifier.fillMaxWidth().padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Text(title, fontWeight = FontWeight.SemiBold)
        Spacer(Modifier.height(6.dp))
        Text(detail, color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.7f), fontSize = AppFontSize.Small)
    }
}
