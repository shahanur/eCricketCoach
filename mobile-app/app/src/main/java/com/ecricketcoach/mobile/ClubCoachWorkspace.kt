package com.ecricketcoach.mobile

import android.content.Context
import android.net.ConnectivityManager
import android.net.Network
import android.widget.Toast
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.BorderStroke
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CheckboxDefaults
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.NavigationBarItemDefaults
import androidx.compose.material3.NavigationDrawerItem
import androidx.compose.material3.Tab
import androidx.compose.material3.TabRow
import androidx.compose.material3.ModalNavigationDrawer
import androidx.compose.material3.ModalDrawerSheet
import androidx.compose.material3.DrawerValue
import androidx.compose.material3.rememberDrawerState
import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.widthIn
import androidx.compose.ui.res.painterResource
import androidx.compose.material.icons.outlined.Menu
import androidx.compose.material.icons.outlined.MoreVert
import androidx.compose.material.icons.automirrored.outlined.KeyboardArrowRight
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material.icons.automirrored.outlined.Logout
import androidx.compose.material.icons.outlined.Add
import androidx.compose.material.icons.outlined.AccessTime
import androidx.compose.material.icons.outlined.Assignment
import androidx.compose.material.icons.outlined.AutoAwesome
import androidx.compose.material.icons.outlined.Download
import androidx.compose.material.icons.outlined.Save
import androidx.compose.material.icons.outlined.Share
import androidx.compose.material.icons.outlined.BarChart
import androidx.compose.material.icons.outlined.Bolt
import androidx.compose.material.icons.outlined.CalendarMonth
import androidx.compose.material.icons.outlined.CheckCircle
import androidx.compose.material.icons.outlined.Close
import androidx.compose.material.icons.outlined.Dashboard
import androidx.compose.material.icons.outlined.DarkMode
import androidx.compose.material.icons.outlined.Delete
import androidx.compose.material.icons.outlined.Description
import androidx.compose.material.icons.outlined.DirectionsRun
import androidx.compose.material.icons.outlined.Edit
import androidx.compose.material.icons.outlined.ExpandLess
import androidx.compose.material.icons.outlined.ExpandMore
import androidx.compose.material.icons.outlined.FitnessCenter
import androidx.compose.material.icons.outlined.FilterList
import androidx.compose.material.icons.outlined.Group
import androidx.compose.material.icons.outlined.Groups
import androidx.compose.material.icons.outlined.LibraryBooks
import androidx.compose.material.icons.outlined.LightMode
import androidx.compose.material.icons.outlined.PlayArrow
import androidx.compose.material.icons.outlined.Publish
import androidx.compose.material.icons.outlined.Remove
import androidx.compose.material.icons.outlined.Security
import androidx.compose.material.icons.outlined.Send
import androidx.compose.material.icons.outlined.Settings
import androidx.compose.material.icons.outlined.Sports
import androidx.compose.material.icons.outlined.SportsBaseball
import androidx.compose.material.icons.outlined.SportsCricket
import androidx.compose.material.icons.outlined.Search
import androidx.compose.material.icons.outlined.Sync
import androidx.compose.material.icons.outlined.TrendingUp
import androidx.compose.material.icons.outlined.Videocam
import androidx.compose.material.icons.outlined.Visibility
import androidx.compose.material.icons.outlined.WorkspacePremium
import androidx.compose.material3.Icon
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.snapshots.SnapshotStateMap
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.vector.path
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import coil.compose.AsyncImage
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.launch
import org.json.JSONArray
import org.json.JSONObject
import java.time.LocalDate
import java.time.LocalTime
import java.time.format.DateTimeFormatter
import java.io.IOException
import java.util.Locale

private val ClubDisciplines = listOf("BATTING", "BOWLING", "KEEPING", "FIELDING")
private data class OverviewQuickAction(
    val label: String,
    val icon: androidx.compose.ui.graphics.vector.ImageVector,
    val color: Color,
    val endColor: Color,
    val destination: String
)
private val EkotaOverviewColors = lightColorScheme(
    primary = Color(0xFF5134D8),
    onPrimary = Color.White,
    secondary = Color(0xFF2589F3),
    background = Color(0xFFF7F8FD),
    surface = Color.White,
    surfaceVariant = Color(0xFFF0EEFF),
    onSurface = Color(0xFF151B35),
    onSurfaceVariant = Color(0xFF5B6782),
    outline = Color(0xFFDDE2F1),
    outlineVariant = Color(0xFFE8EAF3),
    error = Color(0xFFD94A66)
)

private fun Modifier.ekotaOverviewBackdrop(): Modifier = drawBehind {
    val w = size.width
    val h = size.height
    drawRect(
        Brush.linearGradient(
            colors = listOf(Color(0xFFF9FAFF), Color(0xFFF5F6FD), Color(0xFFF2F0FF)),
            start = Offset.Zero,
            end = Offset(w, h)
        )
    )
    val upperWash = Path().apply {
        moveTo(w * 0.72f, 0f)
        cubicTo(w * 0.84f, h * 0.04f, w * 0.82f, h * 0.15f, w * 0.75f, h * 0.27f)
        cubicTo(w * 0.67f, h * 0.39f, w * 0.65f, h * 0.48f, w * 0.72f, h * 0.55f)
        cubicTo(w * 0.8f, h * 0.63f, w * 0.88f, h * 0.47f, w * 0.94f, h * 0.35f)
        cubicTo(w * 0.99f, h * 0.24f, w, h * 0.11f, w, 0f)
        close()
    }
    drawPath(
        upperWash,
        Brush.linearGradient(listOf(Color(0x407F68F5), Color(0x147C6AF1)), start = Offset(w * 0.7f, 0f), end = Offset(w * 0.95f, h * 0.58f))
    )
    val lowerWash = Path().apply {
        moveTo(0f, h * 0.75f)
        cubicTo(w * 0.12f, h * 0.76f, w * 0.18f, h * 0.95f, w * 0.34f, h * 0.96f)
        cubicTo(w * 0.5f, h * 0.98f, w * 0.58f, h * 0.86f, w * 0.72f, h * 0.94f)
        cubicTo(w * 0.84f, h, w * 0.93f, h * 0.88f, w, h * 0.83f)
        lineTo(w, h)
        lineTo(0f, h)
        close()
    }
    drawPath(
        lowerWash,
        Brush.linearGradient(listOf(Color(0x4D8873F5), Color(0x1A9D9FF3), Color(0x0DFFFFFF)), start = Offset(0f, h * 0.78f), end = Offset(w, h))
    )
    val lowerHighlight = Path().apply {
        moveTo(0f, h * 0.85f)
        cubicTo(w * 0.17f, h * 0.84f, w * 0.21f, h * 0.97f, w * 0.4f, h * 0.98f)
        cubicTo(w * 0.58f, h, w * 0.72f, h * 0.91f, w, h * 0.94f)
        lineTo(w, h)
        lineTo(0f, h)
        close()
    }
    drawPath(lowerHighlight, Color(0x20FFFFFF))
}

// Material has no wicket-keeping gloves, so draw an outlined mirrored pair in the same 24dp style.
private fun androidx.compose.ui.graphics.vector.PathBuilder.keepingGlove(originX: Float, originY: Float, scale: Float, mirrored: Boolean) {
    // Source glove spans x 5.3..17, y 4.5..21.2; mirrored copies flip horizontally around originX.
    fun x(v: Float) = if (mirrored) originX - (v - 5.3f) * scale else originX + (v - 5.3f) * scale
    fun y(v: Float) = originY + (v - 4.5f) * scale
    val r = scale
    val sweep = !mirrored
    moveTo(x(10.5f), y(18.5f))
    lineTo(x(6.6f), y(14.2f))
    lineTo(x(5.3f), y(11.6f))
    arcTo(1.15f * r, 1.15f * r, 0f, false, sweep, x(7.3f), y(10.5f))
    lineTo(x(9f), y(12.4f))
    lineTo(x(9f), y(6f))
    arcTo(r, r, 0f, false, sweep, x(11f), y(6f))
    lineTo(x(11f), y(4.5f))
    arcTo(r, r, 0f, false, sweep, x(13f), y(4.5f))
    lineTo(x(13f), y(5f))
    arcTo(r, r, 0f, false, sweep, x(15f), y(5f))
    lineTo(x(15f), y(6.6f))
    arcTo(r, r, 0f, false, sweep, x(17f), y(6.6f))
    lineTo(x(17f), y(14.5f))
    quadTo(x(17f), y(18.5f), x(14f), y(18.5f))
    close()
    // Finger seams.
    moveTo(x(11f), y(6f)); lineTo(x(11f), y(10.5f))
    moveTo(x(13f), y(5f)); lineTo(x(13f), y(10.5f))
    moveTo(x(15f), y(6.6f)); lineTo(x(15f), y(10.5f))
    // Cuff.
    moveTo(x(10.3f), y(18.5f))
    lineTo(x(10.3f), y(21.2f))
    lineTo(x(15.7f), y(21.2f))
    lineTo(x(15.7f), y(18.2f))
}

private val KeepingGloveIcon: androidx.compose.ui.graphics.vector.ImageVector by lazy {
    androidx.compose.ui.graphics.vector.ImageVector.Builder(
        name = "KeepingGloves",
        defaultWidth = 24.dp,
        defaultHeight = 24.dp,
        viewportWidth = 24f,
        viewportHeight = 24f
    ).path(
        fill = null,
        stroke = androidx.compose.ui.graphics.SolidColor(androidx.compose.ui.graphics.Color.Black),
        strokeLineWidth = 1.4f,
        strokeLineCap = androidx.compose.ui.graphics.StrokeCap.Round,
        strokeLineJoin = androidx.compose.ui.graphics.StrokeJoin.Round
    ) {
        // Left glove has its thumb on the outer left; the right glove mirrors it.
        keepingGlove(originX = 1.3f, originY = 5.2f, scale = 0.8f, mirrored = false)
        keepingGlove(originX = 22.7f, originY = 5.2f, scale = 0.8f, mirrored = true)
    }.build()
}

private fun disciplineIcon(discipline: String) = when (discipline.uppercase()) {
    "BATTING" -> Icons.Outlined.SportsCricket
    "BOWLING" -> Icons.Outlined.SportsBaseball
    "KEEPING" -> KeepingGloveIcon
    "FIELDING" -> Icons.Outlined.DirectionsRun
    else -> Icons.Outlined.Sports
}
// Disciplines are distinguished by icon; colour stays on-brand so cards read as one family.
@Composable
private fun DisciplineChip(discipline: String, modifier: Modifier = Modifier) {
    val scheme = MaterialTheme.colorScheme
    val accent = when (discipline.uppercase()) {
        "BOWLING" -> Color(0xFF2679F4)
        "BATTING" -> Color(0xFF13A875)
        "FIELDING" -> Color(0xFFE59A12)
        "KEEPING" -> Color(0xFF7541E8)
        else -> scheme.primary
    }
    Surface(
        shape = RoundedCornerShape(50),
        color = accent.copy(alpha = 0.1f),
        border = BorderStroke(1.dp, accent.copy(alpha = 0.14f)),
        modifier = modifier
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(horizontal = 12.dp, vertical = 7.dp)) {
            Icon(disciplineIcon(discipline), contentDescription = null, tint = accent, modifier = Modifier.size(17.dp))
            Spacer(Modifier.width(6.dp))
            Text(
                discipline.lowercase().replaceFirstChar { it.uppercase() },
                fontSize = 13.sp,
                color = accent,
                fontWeight = FontWeight.Bold
            )
        }
    }
}
private fun sessionStatusLabel(session: ClubTrainingSession) = when {
    session.isExecuted -> "Completed"
    session.executionLog?.optString("status") == "PAUSED" -> "Paused"
    session.executionLog?.optString("status") == "IN_PROGRESS" -> "In progress"
    session.isPublished -> "Published"
    else -> "Draft"
}
private fun sessionStatusColor(session: ClubTrainingSession) = when {
    session.isExecuted -> Color(0xFF2E7D32)
    session.executionLog?.optString("status") == "PAUSED" -> Color(0xFFB7791F)
    session.executionLog?.optString("status") == "IN_PROGRESS" -> Color(0xFF18B982)
    session.isPublished -> Color(0xFF1565C0)
    else -> Color(0xFF757575)
}
private val AssessmentMetricNames = mapOf(
    "BATTING" to listOf("Stance & balance", "Footwork", "Shot selection", "Timing & contact", "Running between wickets"),
    "BOWLING" to listOf("Run-up & rhythm", "Action & alignment", "Release point", "Accuracy", "Follow-through"),
    "KEEPING" to listOf("Stance & readiness", "Footwork", "Glove technique", "Catching & gathering", "Communication"),
    "FIELDING" to listOf("Ready position", "Movement & agility", "Ground fielding", "Throwing accuracy", "Communication")
)

@Composable
internal fun WorkspaceAction(
    label: String,
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    onClick: () -> Unit,
    enabled: Boolean = true,
    primary: Boolean = false,
    trailingIcon: androidx.compose.ui.graphics.vector.ImageVector? = null
) {
    if (primary) {
        Button(onClick = onClick, enabled = enabled, shape = RoundedCornerShape(14.dp)) {
            Icon(icon, contentDescription = null)
            Spacer(Modifier.padding(horizontal = 3.dp))
            Text(label)
            trailingIcon?.let {
                Spacer(Modifier.padding(horizontal = 3.dp))
                Icon(it, contentDescription = null, modifier = Modifier.size(18.dp))
            }
        }
    } else {
        TextButton(onClick = onClick, enabled = enabled) {
            Icon(icon, contentDescription = null)
            Spacer(Modifier.padding(horizontal = 2.dp))
            Text(label)
            trailingIcon?.let {
                Spacer(Modifier.padding(horizontal = 2.dp))
                Icon(it, contentDescription = null, modifier = Modifier.size(18.dp))
            }
        }
    }
}

@Composable
private fun WorkspaceField(
    value: String,
    onValueChange: (String) -> Unit,
    label: String,
    modifier: Modifier = Modifier,
    singleLine: Boolean = true,
    enabled: Boolean = true
) {
    OutlinedTextField(
        value = value,
        onValueChange = onValueChange,
        label = { Text(label) },
        modifier = modifier,
        singleLine = singleLine,
        enabled = enabled,
        shape = RoundedCornerShape(14.dp),
        colors = androidx.compose.material3.OutlinedTextFieldDefaults.colors(
            focusedBorderColor = MaterialTheme.colorScheme.primary,
            unfocusedBorderColor = MaterialTheme.colorScheme.outline.copy(alpha = 0.7f)
        )
    )
}

/** Read-only field that opens the native Android date picker, matching the "YYYY-MM-DD" format used across the workspace. */
@Composable
internal fun DateField(
    value: String,
    onValueChange: (String) -> Unit,
    label: String,
    modifier: Modifier = Modifier,
    enabled: Boolean = true
) {
    val context = LocalContext.current
    fun openPicker() {
        val initial = runCatching { LocalDate.parse(value) }.getOrDefault(LocalDate.now())
        android.app.DatePickerDialog(
            context,
            { _, year, month, day -> onValueChange(LocalDate.of(year, month + 1, day).toString()) },
            initial.year, initial.monthValue - 1, initial.dayOfMonth
        ).show()
    }
    Box(modifier) {
        OutlinedTextField(
            value = value,
            onValueChange = {},
            readOnly = true,
            enabled = enabled,
            label = { Text(label) },
            trailingIcon = { Icon(Icons.Outlined.CalendarMonth, contentDescription = null) },
            modifier = Modifier.fillMaxWidth(),
            singleLine = true,
            shape = RoundedCornerShape(14.dp),
            colors = androidx.compose.material3.OutlinedTextFieldDefaults.colors(
                focusedBorderColor = MaterialTheme.colorScheme.primary,
                unfocusedBorderColor = MaterialTheme.colorScheme.outline.copy(alpha = 0.7f)
            )
        )
        if (enabled) {
            Box(
                Modifier
                    .matchParentSize()
                    .clip(RoundedCornerShape(14.dp))
                    .clickable(indication = null, interactionSource = remember { MutableInteractionSource() }) { openPicker() }
            )
        }
    }
}

/** Read-only field that opens the native Android time picker, storing the value as "HH:mm". */
@Composable
internal fun TimeField(
    value: String,
    onValueChange: (String) -> Unit,
    label: String,
    modifier: Modifier = Modifier,
    enabled: Boolean = true
) {
    val context = LocalContext.current
    fun openPicker() {
        val parts = value.split(":").mapNotNull(String::toIntOrNull)
        val initialHour = parts.getOrNull(0) ?: 9
        val initialMinute = parts.getOrNull(1) ?: 0
        android.app.TimePickerDialog(
            context,
            { _, hour, minute -> onValueChange("%02d:%02d".format(hour, minute)) },
            initialHour, initialMinute, true
        ).show()
    }
    Box(modifier) {
        OutlinedTextField(
            value = value,
            onValueChange = {},
            readOnly = true,
            enabled = enabled,
            label = { Text(label) },
            trailingIcon = { Icon(Icons.Outlined.AccessTime, contentDescription = null) },
            modifier = Modifier.fillMaxWidth(),
            singleLine = true,
            shape = RoundedCornerShape(14.dp),
            colors = androidx.compose.material3.OutlinedTextFieldDefaults.colors(
                focusedBorderColor = MaterialTheme.colorScheme.primary,
                unfocusedBorderColor = MaterialTheme.colorScheme.outline.copy(alpha = 0.7f)
            )
        )
        if (enabled) {
            Box(
                Modifier
                    .matchParentSize()
                    .clip(RoundedCornerShape(14.dp))
                    .clickable(indication = null, interactionSource = remember { MutableInteractionSource() }) { openPicker() }
            )
        }
    }
}

private data class ClubWorkspaceSnapshot(
    val members: List<ClubMember>,
    val squads: List<ClubSquad>,
    val sessions: List<ClubTrainingSession>,
    val drills: List<Drill>,
    val catalogueDrills: List<Drill>,
    val certificates: List<ClubCertificate>,
    val logo: String?
)

@Composable
internal fun ClubCoachWorkspace(
    api: CoachApi,
    store: AuthStore,
    token: String,
    user: CoachUser,
    drills: List<Drill>,
    templates: List<TrainingTemplate>,
    isDark: Boolean,
    onToggleTheme: () -> Unit,
    onSignOut: () -> Unit
) {
    val clubId = user.tenantId.orEmpty()
    val isClubAdmin = user.role == "CLUB_ADMIN"
    val isClubCoach = user.role == "COACH" && user.coachContext == "CLUB"
    var tab by remember { mutableStateOf("Overview") }
    var members by remember { mutableStateOf<List<ClubMember>>(emptyList()) }
    var squads by remember { mutableStateOf<List<ClubSquad>>(emptyList()) }
    var sessions by remember { mutableStateOf<List<ClubTrainingSession>>(emptyList()) }
    var reportMembers by remember { mutableStateOf<List<ClubMember>>(emptyList()) }
    var reportSessions by remember { mutableStateOf<List<ClubTrainingSession>>(emptyList()) }
    var reportError by remember { mutableStateOf("") }
    var assessments by remember { mutableStateOf<List<PlayerAssessment>>(emptyList()) }
    var clubDrills by remember { mutableStateOf(drills.filter { it.id.startsWith("drill-club-") }) }
    var catalogueDrills by remember { mutableStateOf(drills) }
    var certificates by remember { mutableStateOf<List<ClubCertificate>>(emptyList()) }
    var driveConnected by remember { mutableStateOf(false) }
    var driveEmail by remember { mutableStateOf("") }
    var driveVideos by remember { mutableStateOf<List<DriveVideoFile>>(emptyList()) }
    var driveError by remember { mutableStateOf("") }
    var clubLogo by remember { mutableStateOf<String?>(null) }
    var loading by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf("") }
    var notice by remember { mutableStateOf("") }
    var showInvite by remember { mutableStateOf(false) }
    var showCreateSquad by remember { mutableStateOf(false) }
    var editingSquad by remember { mutableStateOf<ClubSquad?>(null) }
    var squadEditSaving by remember { mutableStateOf(false) }
    var squadEditError by remember { mutableStateOf("") }
    var scheduleSaving by remember { mutableStateOf(false) }
    var scheduleError by remember { mutableStateOf("") }
    var editingSession by remember { mutableStateOf<ClubTrainingSession?>(null) }
    var sessionEditSaving by remember { mutableStateOf(false) }
    var sessionEditError by remember { mutableStateOf("") }
    var sessionDrillBusy by remember { mutableStateOf(false) }
    var showScheduleAssessment by remember { mutableStateOf(false) }
    var editingAssessment by remember { mutableStateOf<PlayerAssessment?>(null) }
    var assessmentEditSaving by remember { mutableStateOf(false) }
    var assessmentEditError by remember { mutableStateOf("") }
    var executingSession by remember { mutableStateOf<ClubTrainingSession?>(null) }
    var executionCoachPage by remember { mutableStateOf("LIVE") }
    var activeAssessment by remember { mutableStateOf<PlayerAssessment?>(null) }
    var assessmentRunSaving by remember { mutableStateOf(false) }
    var assessmentInsightsBusy by remember { mutableStateOf(false) }
    var assessmentReportBusy by remember { mutableStateOf(false) }
    var assessmentRunError by remember { mutableStateOf("") }
    var selectedPromotionPlayer by remember { mutableStateOf<ClubMember?>(null) }
    var executionSaving by remember { mutableStateOf(false) }
    var executionError by remember { mutableStateOf("") }
    var aiAnalysisBusy by remember { mutableStateOf(false) }
    var aiAnalysisError by remember { mutableStateOf("") }
    var followUpBusy by remember { mutableStateOf(false) }
    var followUpError by remember { mutableStateOf("") }
    var createdFollowUpSession by remember { mutableStateOf<ClubTrainingSession?>(null) }
    var sessionObservations by remember { mutableStateOf<List<SessionObservation>>(emptyList()) }
    var sessionObservationsError by remember { mutableStateOf("") }
    var queuedMutations by remember { mutableStateOf<List<OfflineMutation>>(emptyList()) }
    var discardMutation by remember { mutableStateOf<OfflineMutation?>(null) }
    val scope = rememberCoroutineScope()
    val context = LocalContext.current

    fun reloadQueue(): Boolean {
        try {
            queuedMutations = store.queuedMutations(user.id, clubId)
            return true
        } catch (failure: Exception) {
            error = "Unable to read the encrypted offline queue: ${failure.message ?: "storage error"}"
            return false
        }
    }

    suspend fun applyQueuedMutation(mutation: OfflineMutation) {
        when (mutation.kind) {
            OfflineMutation.UPDATE_MEMBER_SQUAD -> {
                val membersAtServer = api.getClubMembers(token, clubId)
                val member = membersAtServer.firstOrNull { it.id == mutation.resourceId }
                    ?: throw OfflineMutationConflict("The member no longer belongs to this club. This change was not replayed.")
                val payload = JSONObject(mutation.payload)
                if (payload.has("addSquad") || payload.has("removeSquad")) {
                    // Add/remove edits only touch one squad, so they replay safely alongside other server changes.
                    val adding = payload.has("addSquad")
                    val squadName = if (adding) payload.getString("addSquad") else payload.getString("removeSquad")
                    if (member.isInSquad(squadName) == adding) return
                    api.updateClubMember(token, mutation.resourceId, payload, operationId = mutation.id)
                    return
                }
                val targetSquad = payload.getString("squad")
                when (member.squad) {
                    targetSquad -> return
                    mutation.baseValue -> api.updateClubMember(
                        token,
                        mutation.resourceId,
                        JSONObject(mutation.payload),
                        operationId = mutation.id
                    )
                    else -> throw OfflineMutationConflict(
                        "Squad assignment changed on the server from '${mutation.baseValue}' to '${member.squad}'. Review the roster before applying this edit."
                    )
                }
            }
            OfflineMutation.SAVE_SESSION_EXECUTION -> {
                val update = JSONObject(mutation.payload)
                val current = api.getCoachSessionExecution(token, mutation.resourceId)
                val targetLog = update.getJSONObject("executionLog")
                val targetNotes = update.optJSONObject("playerNotes") ?: JSONObject()
                val targetPostNotes = update.optString("postNotes")
                val executionAlreadySaved = canonicalJson(current.executionLog?.toString()) == canonicalJson(targetLog.toString()) &&
                    targetNotes.keys().asSequence().all { playerId ->
                        current.playerNotes.optString(playerId) == targetNotes.optString(playerId)
                    } && current.postNotes == targetPostNotes
                if (executionAlreadySaved) return
                if (canonicalJson(current.executionLog?.toString()) != canonicalJson(mutation.baseValue)) {
                    throw OfflineMutationConflict(
                        "Session execution changed on the server while this edit was offline. The queued changes were retained for review and were not applied."
                    )
                }
                api.saveSessionExecution(token, mutation.resourceId, update, operationId = mutation.id)
            }
            else -> throw OfflineMutationConflict("This queued change type is not supported and was not replayed.")
        }
    }

    suspend fun synchronizeQueuedMutations() {
        if (!reloadQueue()) return
        val work = queuedMutations.filter { it.state == "PENDING" }
        for (mutation in work) {
            try {
                applyQueuedMutation(mutation)
                store.updateQueuedMutation(mutation.copy(state = "SYNCED", error = "", attempts = mutation.attempts + 1))
            } catch (failure: CancellationException) {
                throw failure
            } catch (failure: OfflineMutationConflict) {
                store.updateQueuedMutation(mutation.copy(state = "FAILED", error = failure.message.orEmpty(), attempts = mutation.attempts + 1))
            } catch (failure: ApiException) {
                store.updateQueuedMutation(mutation.copy(
                    state = "FAILED",
                    error = "Server rejected the queued edit (HTTP ${failure.statusCode}): ${failure.message}",
                    attempts = mutation.attempts + 1
                ))
            } catch (failure: IOException) {
                store.updateQueuedMutation(mutation.copy(
                    error = failure.message ?: "Network unavailable. The edit remains queued.",
                    attempts = mutation.attempts + 1
                ))
                break
            } catch (failure: Exception) {
                store.updateQueuedMutation(mutation.copy(
                    state = "FAILED",
                    error = failure.message ?: "Unable to safely apply this queued edit.",
                    attempts = mutation.attempts + 1
                ))
            }
        }
        reloadQueue()
    }

    suspend fun refresh() {
        if (clubId.isBlank()) {
            error = "This account is not linked to a club."
            return
        }
        loading = true
        error = ""
        try {
            val snapshot = coroutineScope {
                val membersRequest = async { api.getClubMembers(token, clubId) }
                val squadsRequest = async { api.getSquads(token, clubId) }
                val sessionsRequest = async { api.getClubSessions(token, clubId) }
                val drillsRequest = async { api.getClubDrills(token, clubId) }
                val catalogueRequest = async { api.getDrills(token, clubId) }
                val certificatesRequest = async { api.getCertificates(token) }
                val logoRequest = async { api.getClubBranding(token) }
                ClubWorkspaceSnapshot(
                    members = membersRequest.await(),
                    squads = squadsRequest.await(),
                    sessions = sessionsRequest.await(),
                    drills = drillsRequest.await(),
                    catalogueDrills = catalogueRequest.await(),
                    certificates = certificatesRequest.await(),
                    logo = logoRequest.await()
                )
            }
            members = snapshot.members
            squads = snapshot.squads
            sessions = snapshot.sessions
            clubDrills = snapshot.drills
            catalogueDrills = snapshot.catalogueDrills
            certificates = snapshot.certificates
            clubLogo = snapshot.logo
            try {
                val (scopedMembers, scopedSessions) = api.getClubSessionReportData(token)
                reportMembers = scopedMembers
                reportSessions = scopedSessions
                reportError = ""
            } catch (failure: CancellationException) {
                throw failure
            } catch (failure: Exception) {
                reportError = failure.message ?: "Unable to load this club's session report."
            }
            if (isClubAdmin || isClubCoach) {
                assessments = api.getPlayerAssessments(token)
            }
        } catch (failure: CancellationException) {
            throw failure
        } catch (failure: Exception) {
            error = failure.message ?: "Unable to synchronize club workspace."
        } finally {
            loading = false
        }
    }

    fun assignMemberToSquad(member: ClubMember, squad: String, inSquad: Boolean) {
        scope.launch {
            error = ""
            notice = ""
            if (queuedMutations.any {
                    it.kind == OfflineMutation.UPDATE_MEMBER_SQUAD &&
                        it.resourceId == member.id && it.state == "PENDING"
                }) {
                error = "This member already has a pending offline assignment. Sync it before making another change."
                return@launch
            }
            val payload = if (inSquad) JSONObject().put("addSquad", squad) else JSONObject().put("removeSquad", squad)
            try {
                api.updateClubMember(token, member.id, payload)
                refresh()
                notice = if (inSquad) "${member.name} added to $squad." else "${member.name} removed from $squad."
            } catch (failure: IOException) {
                try {
                    store.enqueueMutation(
                        OfflineMutation(
                            userId = user.id,
                            tenantId = clubId,
                            kind = OfflineMutation.UPDATE_MEMBER_SQUAD,
                            resourceId = member.id,
                            payload = payload.toString(),
                            baseValue = member.squad
                        )
                    )
                    reloadQueue()
                    notice = "Squad assignment saved on this device and queued for synchronization. It is not yet saved on the server."
                } catch (storageFailure: Exception) {
                    error = "The network is unavailable and this edit could not be safely queued: ${storageFailure.message ?: "encrypted storage error"}"
                }
            } catch (failure: Exception) {
                error = failure.message ?: "Unable to update member assignment."
            }
        }
    }

    LaunchedEffect(token, clubId) {
        reloadQueue()
        synchronizeQueuedMutations()
        refresh()
    }
    DisposableEffect(token, clubId) {
        val manager = context.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
        val callback = object : ConnectivityManager.NetworkCallback() {
            override fun onAvailable(network: Network) {
                scope.launch {
                    synchronizeQueuedMutations()
                    refresh()
                }
            }
        }
        manager.registerDefaultNetworkCallback(callback)
        onDispose { manager.unregisterNetworkCallback(callback) }
    }
    LaunchedEffect(token) {
        if (token.isNotBlank()) {
            try {
                val (connected, email) = api.getGoogleDriveStatus(token)
                driveConnected = connected
                driveEmail = email.orEmpty()
            } catch (failure: CancellationException) {
                throw failure
            } catch (failure: Exception) {
                driveError = failure.message ?: "Unable to check Google Drive connection."
            }
        }
    }

    BoxWithConstraints(Modifier.fillMaxSize()) {
        val isTablet = maxWidth >= 600.dp
        val isEkotaStyledPage = tab in setOf(
            "Overview", "Squads", "Sessions", "Edit session", "Schedule session",
            "Assessments", "Edit assessment", "Assessment", "Video Analysis"
        )
        val workspaceTabs = remember(isClubAdmin) {
            buildList {
                add("Overview")
                add("Video Analysis")
                if (isClubAdmin) add("Members")
                addAll(listOf("Squads", "Sessions", "Assessments", "Reports", "Certificates", "Drills", "Templates", "Progression"))
                if (isClubAdmin) add("Settings")
            }
        }
        val drawerState = rememberDrawerState(DrawerValue.Closed)
        val sectionTab = workspaceSectionFor(tab)
        val bottomTabs = listOf("Overview", "Squads", "Sessions", "Assessments", "Video Analysis")
        ModalNavigationDrawer(
                drawerState = drawerState,
                gesturesEnabled = true,
                drawerContent = {
                    CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Ltr) {
                ModalDrawerSheet(
                    modifier = Modifier.width(210.dp),
                    drawerContainerColor = Color(0xFF111A35),
                    drawerContentColor = Color.White
                ) {
                    Column(Modifier.fillMaxSize().padding(vertical = 14.dp)) {
                        Row(Modifier.padding(horizontal = 18.dp, vertical = 8.dp), verticalAlignment = Alignment.CenterVertically) {
                            Surface(shape = RoundedCornerShape(12.dp), color = Color(0xFF5631DC), modifier = Modifier.size(42.dp)) {
                                Box(contentAlignment = Alignment.Center) {
                                    Icon(Icons.Outlined.SportsCricket, contentDescription = null, tint = Color.White, modifier = Modifier.size(24.dp))
                                }
                            }
                            Spacer(Modifier.width(11.dp))
                            Column {
                                Text("Ekota", fontWeight = FontWeight.ExtraBold, fontSize = 18.sp, color = Color.White)
                                Text("Academy", fontWeight = FontWeight.SemiBold, fontSize = 13.sp, color = Color(0xFFD2D8EB))
                            }
                        }
                        HorizontalDivider(Modifier.padding(horizontal = 16.dp, vertical = 10.dp), color = Color.White.copy(alpha = 0.14f))
                        Column(Modifier.weight(1f).verticalScroll(rememberScrollState()).padding(horizontal = 12.dp)) {
                            workspaceTabs.forEach { item ->
                                val selected = sectionTab == item
                                Box(
                                    Modifier.fillMaxWidth().height(48.dp).clip(RoundedCornerShape(24.dp))
                                        .background(if (selected) Brush.horizontalGradient(listOf(Color(0xFF7527F5), Color(0xFF3448DF))) else Brush.horizontalGradient(listOf(Color.Transparent, Color.Transparent)))
                                        .clickable {
                                            tab = item
                                            scope.launch { drawerState.close() }
                                        }
                                        .padding(horizontal = 14.dp),
                                    contentAlignment = Alignment.CenterStart
                                ) {
                                    Row(verticalAlignment = Alignment.CenterVertically) {
                                        Icon(workspaceTabIcon(item), contentDescription = null, tint = if (selected) Color.White else Color(0xFFD2D8EB), modifier = Modifier.size(21.dp))
                                        Text(item, color = if (selected) Color.White else Color(0xFFD2D8EB), fontWeight = if (selected) FontWeight.Bold else FontWeight.Medium, fontSize = 14.sp, modifier = Modifier.padding(start = 12.dp))
                                    }
                                }
                                Spacer(Modifier.height(5.dp))
                            }
                        }
                        HorizontalDivider(Modifier.padding(horizontal = 16.dp, vertical = 8.dp), color = Color.White.copy(alpha = 0.14f))
                        Row(Modifier.fillMaxWidth().padding(horizontal = 18.dp, vertical = 8.dp), verticalAlignment = Alignment.CenterVertically) {
                            val initials = user.name.split(Regex("\\s+")).filter(String::isNotBlank).take(2).mapNotNull { it.firstOrNull()?.uppercaseChar() }.joinToString("").ifBlank { "U" }
                            Surface(shape = CircleShape, color = Color(0xFF8A65F5), modifier = Modifier.size(38.dp)) {
                                Box(contentAlignment = Alignment.Center) { Text(initials, color = Color.White, fontWeight = FontWeight.Bold, fontSize = 13.sp) }
                            }
                            Column(Modifier.weight(1f).padding(start = 9.dp)) {
                                Text(user.name, color = Color.White, fontWeight = FontWeight.SemiBold, fontSize = 13.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
                                Text(if (user.role == "CLUB_ADMIN") "Club Admin" else "Coach", color = Color(0xFFBEC7DE), fontSize = 12.sp)
                            }
                        }
                    }
                }
                    }
                }
            ) {
                CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Ltr) {
        Column(Modifier.fillMaxSize()) {
        Row(Modifier.fillMaxWidth().weight(1f)) {
            Column(
                Modifier
                    .weight(1f)
                    .fillMaxSize()
                    .then(
                        if (isEkotaStyledPage) Modifier.ekotaOverviewBackdrop()
                        else Modifier.background(Brush.verticalGradient(listOf(MaterialTheme.colorScheme.background, MaterialTheme.colorScheme.surface.copy(alpha = 0.82f))))
                    )
                    .padding(horizontal = 16.dp, vertical = 12.dp)
            ) {
                EkotaWorkspaceHeader(
                    tab,
                    user,
                    isDark,
                    onToggleTheme,
                    onSignOut,
                    activeSession = executingSession,
                    activeAssessment = activeAssessment.takeIf { tab == "Assessment" },
                    onAssessmentBack = { activeAssessment = null; tab = "Assessments" },
                    activeSessionPageTitle = when (executionCoachPage) {
                        "DRILL" -> "Drill controls"
                        "OBSERVATION" -> "New observation"
                        "OBSERVATIONS" -> "Observations"
                        "PRECHECK" -> "Pre-check"
                        "WENT_WELL" -> "Went well"
                        "DISRUPTION" -> "Disruption"
                        "ADJUSTMENT" -> "Adjustment"
                        "INCIDENT" -> "Incident"
                        else -> null
                    },
                    onSessionBack = {
                        if (executionCoachPage in setOf("DRILL", "OBSERVATION", "OBSERVATIONS", "PRECHECK", "WENT_WELL", "DISRUPTION", "ADJUSTMENT", "INCIDENT")) {
                            executionCoachPage = "LIVE"
                        } else {
                            executingSession = null
                            aiAnalysisError = ""
                            followUpError = ""
                            createdFollowUpSession = null
                        }
                    }
                )
                if (!isTablet && sectionTab != tab) {
                    Row(
                        Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()).padding(top = 8.dp, bottom = 2.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            sectionTab,
                            color = MaterialTheme.colorScheme.primary,
                            fontSize = 12.sp,
                            fontWeight = FontWeight.SemiBold,
                            modifier = Modifier.clip(RoundedCornerShape(6.dp)).clickable { tab = sectionTab }.padding(horizontal = 4.dp, vertical = 2.dp)
                        )
                        Icon(
                            Icons.AutoMirrored.Outlined.KeyboardArrowRight,
                            contentDescription = null,
                            tint = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.5f),
                            modifier = Modifier.size(16.dp)
                        )
                        Text(tab, fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.75f), modifier = Modifier.padding(horizontal = 4.dp))
                    }
                }
                Spacer(Modifier.height(if (isTablet) 0.dp else 6.dp))
                if (error.isNotBlank()) {
            Text(error, color = MaterialTheme.colorScheme.error, fontSize = 13.sp, modifier = Modifier.padding(vertical = 6.dp))
        }
        LaunchedEffect(notice) {
            if (notice.isNotBlank()) {
                Toast.makeText(context, notice, if (notice.length > 60) Toast.LENGTH_LONG else Toast.LENGTH_SHORT).show()
                notice = ""
            }
        }
        val pendingCount = queuedMutations.count { it.state == "PENDING" }
        val failedMutations = queuedMutations.filter { it.state == "FAILED" }
        val syncedCount = queuedMutations.count { it.state == "SYNCED" }
        if (queuedMutations.isNotEmpty()) {
            Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)) {
                Column(Modifier.fillMaxWidth().padding(10.dp), verticalArrangement = Arrangement.spacedBy(3.dp)) {
                    Text("Offline edits: $pendingCount pending · ${failedMutations.size} failed · $syncedCount synced", fontWeight = FontWeight.SemiBold)
                    failedMutations.take(3).forEach { mutation ->
                        Text("${mutation.kind} · ${mutation.error}", color = MaterialTheme.colorScheme.error, fontSize = 12.sp)
                        TextButton(onClick = { discardMutation = mutation }) { Text("Discard this failed edit…") }
                    }
                }
            }
        }
        val onExecuteSession: (ClubTrainingSession) -> Unit = { session ->
            scope.launch {
                executionError = ""
                if (queuedMutations.any {
                        it.kind == OfflineMutation.SAVE_SESSION_EXECUTION &&
                            it.resourceId == session.id && it.state == "PENDING"
                    }) {
                    error = "This session already has unsynchronized progress. Sync it before making another execution edit."
                    return@launch
                }
                try {
                    executingSession = api.getCoachSessionExecution(token, session.id)
                    sessionObservations = emptyList()
                    sessionObservationsError = ""
                    try {
                        sessionObservations = api.getSessionObservations(token, session.id)
                    } catch (failure: Exception) {
                        sessionObservationsError = failure.message ?: "Unable to load session observations."
                    }
                } catch (failure: IOException) {
                    executingSession = session
                    notice = "Offline session workspace opened from the last synchronized copy. Saves will remain pending until the assigned coach can sync."
                } catch (failure: Exception) {
                    error = failure.message ?: "Unable to load the assigned session execution."
                }
            }
        }
        val activeExecution = executingSession
        if (activeExecution != null) {
            val executionContentModifier = Modifier.weight(1f)
            MaterialTheme(colorScheme = LiveSessionLightColors) {
                SessionExecutionScreen(
                    session = activeExecution,
                    players = members.filter {
                        it.role == "PLAYER" &&
                            (it.invitationStatus == "ACTIVE" || it.id in activeExecution.assignedPlayerIds)
                    },
                    drills = drills + clubDrills,
                    readOnly = activeExecution.isExecuted,
                    coachPage = executionCoachPage,
                    onCoachPageChange = { executionCoachPage = it },
                    onDismiss = {
                        executingSession = null
                        executionCoachPage = "LIVE"
                        aiAnalysisError = ""
                        followUpError = ""
                        createdFollowUpSession = null
                    },
                    modifier = executionContentModifier,
                    isSaving = executionSaving,
                    saveError = executionError,
                    aiBusy = aiAnalysisBusy,
                    aiError = aiAnalysisError,
                    followUpBusy = followUpBusy,
                    followUpError = followUpError,
                    createdFollowUp = createdFollowUpSession,
                    observations = sessionObservations,
                    observationLoadError = sessionObservationsError,
                    onReloadObservations = {
                        sessionObservationsError = ""
                        try {
                            sessionObservations = api.getSessionObservations(token, activeExecution.id)
                        } catch (failure: Exception) {
                            sessionObservationsError = failure.message ?: "Unable to load session observations."
                        }
                    },
                    onAddObservation = { draft ->
                        val created = api.createSessionObservation(token, activeExecution.id, draft)
                        sessionObservations = listOf(created) + sessionObservations.filterNot { it.id == created.id }
                        created
                    },
                    onAddPlayer = { draft ->
                        val addition = api.addSessionPlayer(token, activeExecution.id, draft)
                        members = members.filterNot { it.id == addition.member.id } + addition.member
                        sessions = sessions.map { if (it.id == addition.session.id) addition.session else it }
                        executingSession = addition.session
                        notice = "${addition.member.name} added as a provisional player and marked present."
                        addition
                    },
                    onRunAiAnalysis = { executionLog, playerNotes, notes ->
                        scope.launch {
                            aiAnalysisBusy = true
                            aiAnalysisError = ""
                            createdFollowUpSession = null
                            try {
                                val update = JSONObject()
                                    .put("executionLog", executionLog)
                                    .put("playerNotes", playerNotes)
                                    .put("postNotes", notes)
                                    .put("complete", false)
                                api.saveSessionExecution(token, activeExecution.id, update)
                                val assessed = api.assessCompletedSession(token, activeExecution.id, notes)
                                sessions = sessions.map { if (it.id == assessed.id) assessed else it }
                                executingSession = assessed
                                notice = "AI session analysis generated."
                            } catch (failure: Exception) {
                                aiAnalysisError = failure.message ?: "AI analysis failed."
                            } finally {
                                aiAnalysisBusy = false
                            }
                        }
                    },
                    onCreateFollowUp = { payload ->
                        scope.launch {
                            followUpBusy = true
                            followUpError = ""
                            try {
                                val (newSession, newDrills) = api.createFollowUpSession(token, activeExecution.id, payload)
                                clubDrills = clubDrills + newDrills.filterNot { created -> clubDrills.any { it.id == created.id } }
                                sessions = sessions + newSession
                                createdFollowUpSession = newSession
                                notice = "Follow-up session created."
                            } catch (failure: Exception) {
                                followUpError = failure.message ?: "Unable to create follow-up session."
                            } finally {
                                followUpBusy = false
                            }
                        }
                    },
                    onSave = { executionLog, playerNotes, notes, complete ->
                        scope.launch {
                            executionSaving = true
                            executionError = ""
                            try {
                                val update = JSONObject()
                                    .put("executionLog", executionLog)
                                    .put("playerNotes", playerNotes)
                                    .put("postNotes", notes)
                                    .put("complete", complete)
                                val updated = api.saveSessionExecution(token, activeExecution.id, update)
                                sessions = sessions.map { if (it.id == updated.id) updated else it }
                                executingSession = when {
                                    complete -> null
                                    executingSession?.id == updated.id -> updated
                                    else -> executingSession
                                }
                                if (complete) executionCoachPage = "LIVE"
                                if (complete) {
                                    refresh()
                                    notice = "Session completed and saved."
                                }
                            } catch (failure: IOException) {
                                try {
                                    val mutation = OfflineMutation(
                                        userId = user.id,
                                        tenantId = clubId,
                                        kind = OfflineMutation.SAVE_SESSION_EXECUTION,
                                        resourceId = activeExecution.id,
                                        payload = JSONObject()
                                            .put("executionLog", executionLog)
                                            .put("playerNotes", playerNotes)
                                            .put("postNotes", notes)
                                            .put("complete", complete)
                                            .toString(),
                                        baseValue = activeExecution.executionLog?.toString() ?: "null"
                                    )
                                    store.enqueueMutation(mutation)
                                    reloadQueue()
                                    executingSession = null
                                    executionCoachPage = "LIVE"
                                    notice = if (complete) {
                                        "Completion is queued on this device. The session is not delivered until the server confirms synchronization."
                                    } else {
                                        "Execution progress is queued on this device and will sync when connectivity returns."
                                    }
                                } catch (storageFailure: Exception) {
                                    executionError = "Network unavailable and this edit could not be safely queued: ${storageFailure.message ?: "encrypted storage error"}"
                                }
                            } catch (failure: Exception) {
                                executionError = failure.message ?: "Unable to save session execution."
                            } finally {
                                executionSaving = false
                            }
                        }
                    }
                )
            }
        } else when (tab) {
            "Overview" -> MaterialTheme(colorScheme = EkotaOverviewColors) {
                OverviewPanel(
                    userId = user.id,
                    isClubAdmin = isClubAdmin,
                    members = members,
                    squads = squads,
                    sessions = sessions,
                    drills = drills + clubDrills,
                    assessments = assessments,
                    loading = loading,
                    onOpen = { tab = it },
                    onExecute = onExecuteSession,
                    modifier = Modifier.weight(1f)
                )
            }
            "Delivered sessions" -> DeliveredSessionsPanel(
                clubName = user.clubName ?: "Club",
                members = members,
                sessions = sessions,
                onBack = { tab = "Overview" },
                modifier = Modifier.weight(1f)
            )
            "Participants" -> ParticipantsPanel(
                members = members,
                onBack = { tab = "Overview" },
                modifier = Modifier.weight(1f)
            )
            "Members" -> MembersPanel(
                members = members,
                canInvite = isClubAdmin,
                onInvite = { showInvite = true },
                onAcceptMember = { member ->
                    val accepted = api.acceptClubMember(token, member.id)
                    members = members.map { if (it.id == accepted.id) accepted else it }
                    notice = "${accepted.name} approved as an active club member."
                },
                onEditMember = { member, updates ->
                    val updated = api.updateClubMember(token, member.id, updates)
                    members = members.map { if (it.id == updated.id) updated else it }
                    refresh()
                    notice = "${member.name} updated."
                },
                onDeleteMember = { member ->
                    api.deleteClubMember(token, member.id)
                    members = members.filterNot { it.id == member.id }
                    refresh()
                    notice = "${member.name} removed from this club."
                },
                modifier = Modifier.weight(1f)
            )
            "Squads" -> MaterialTheme(colorScheme = EkotaOverviewColors) {
                SquadPanel(
                    squads,
                    members = members,
                    onCreate = { showCreateSquad = true },
                    onEdit = { squad ->
                        squadEditError = ""
                        editingSquad = squad
                        tab = "Edit squad"
                    },
                    onDelete = { squad ->
                        scope.launch {
                            error = ""
                            notice = ""
                            try {
                                api.deleteSquad(token, squad.id)
                                refresh()
                                notice = "Squad deleted."
                            } catch (failure: Exception) {
                                error = failure.message ?: "Unable to delete this squad."
                            }
                        }
                    },
                    modifier = Modifier.weight(1f)
                )
            }
            "Edit squad" -> editingSquad?.let { originalSquad ->
                val squad = squads.find { it.id == originalSquad.id } ?: originalSquad
                EditSquadPanel(
                    squad = squad,
                    isSaving = squadEditSaving,
                    saveError = squadEditError,
                    onSave = { name, ageGroup, disciplines ->
                        scope.launch {
                            squadEditSaving = true
                            squadEditError = ""
                            try {
                                api.updateSquad(
                                    token,
                                    squad.id,
                                    JSONObject()
                                        .put("name", name)
                                        .put("ageGroup", ageGroup)
                                        .put("discipline", JSONArray(disciplines))
                                )
                                editingSquad = null
                                tab = "Squads"
                                refresh()
                                notice = "Squad changes saved."
                            } catch (failure: Exception) {
                                squadEditError = failure.message ?: "Unable to save squad changes."
                            } finally {
                                squadEditSaving = false
                            }
                        }
                    },
                    onDelete = {
                        scope.launch {
                            squadEditSaving = true
                            squadEditError = ""
                            try {
                                api.deleteSquad(token, squad.id)
                                editingSquad = null
                                tab = "Squads"
                                refresh()
                                notice = "Squad deleted."
                            } catch (failure: Exception) {
                                squadEditError = failure.message ?: "Unable to delete this squad."
                            } finally {
                                squadEditSaving = false
                            }
                        }
                    },
                    onBack = { editingSquad = null; tab = "Squads" },
                    members = members,
                    onToggleMember = { member, inSquad -> assignMemberToSquad(member, squad.name, inSquad) },
                    modifier = Modifier.weight(1f)
                )
            }
            "Sessions" -> MaterialTheme(colorScheme = EkotaOverviewColors) {
                SessionsPanel(
                sessions = sessions,
                userId = user.id,
                canDeleteAny = isClubAdmin,
                canSchedule = isClubAdmin || isClubCoach,
                canCoachSessions = isClubCoach,
                allDrills = drills + clubDrills,
                onSchedule = { scheduleError = ""; tab = "Schedule session" },
                onEdit = { session ->
                    sessionEditError = ""
                    if (queuedMutations.any {
                            it.kind == OfflineMutation.SAVE_SESSION_EXECUTION &&
                                it.resourceId == session.id && it.state == "PENDING"
                        }) {
                        error = "Sync this session's pending execution before editing its plan."
                    } else {
                        editingSession = session
                        tab = "Edit session"
                    }
                },
                onDelete = { session ->
                    scope.launch {
                        error = ""
                        try {
                            api.deleteClubSession(token, session.id)
                            sessions = sessions.filterNot { it.id == session.id }
                            refresh()
                            notice = "Scheduled session deleted."
                        } catch (failure: Exception) {
                            error = failure.message ?: "Unable to delete this session."
                        }
                    }
                },
                onPublish = { session ->
                    scope.launch {
                        error = ""
                        notice = ""
                        try {
                            api.publishClubSession(token, session.id)
                            refresh()
                            notice = "Session published. Squad members can now see the training plan."
                        } catch (failure: Exception) {
                            error = failure.message ?: "Unable to publish this session."
                        }
                    }
                },
                onExecute = onExecuteSession,

                onReview = { session ->
                    scope.launch {
                        executionError = ""
                        try {
                            executingSession = api.getCoachSessionExecution(token, session.id)
                            sessionObservations = emptyList()
                            sessionObservationsError = ""
                            try {
                                sessionObservations = api.getSessionObservations(token, session.id)
                            } catch (failure: Exception) {
                                sessionObservationsError = failure.message ?: "Unable to load session observations."
                            }
                        } catch (failure: Exception) {
                            error = failure.message ?: "Unable to load this completed session."
                        }
                    }
                },
                    modifier = Modifier.weight(1f)
                )
            }
            "Edit session" -> editingSession?.let { originalSession ->
                val session = sessions.find { it.id == originalSession.id } ?: originalSession
                MaterialTheme(colorScheme = EkotaOverviewColors) { EditSessionPanel(
                    session = session,
                    squads = squads,
                    coaches = members.filter { it.role == "COACH" && it.invitationStatus == "ACTIVE" },
                    allDrills = drills + clubDrills,
                    isSaving = sessionEditSaving,
                    saveError = sessionEditError,
                    drillBusy = sessionDrillBusy,
                    onSave = { title, date, duration, squad, coach, safety ->
                        scope.launch {
                            sessionEditSaving = true
                            sessionEditError = ""
                            try {
                                val updates = sessionPlanUpdates(session, title, date, duration, squad, safety, coach)
                                val updated = api.updateClubSession(token, session.id, updates)
                                sessions = sessions.map { if (it.id == updated.id) updated else it }
                                editingSession = null
                                tab = "Sessions"
                                refresh()
                                notice = "Session changes saved."
                            } catch (failure: Exception) {
                                sessionEditError = failure.message ?: "Unable to save session changes."
                            } finally {
                                sessionEditSaving = false
                            }
                        }
                    },
                    onDelete = {
                        scope.launch {
                            sessionEditSaving = true
                            sessionEditError = ""
                            try {
                                api.deleteClubSession(token, session.id)
                                sessions = sessions.filterNot { it.id == session.id }
                                editingSession = null
                                tab = "Sessions"
                                refresh()
                                notice = "Scheduled session deleted."
                            } catch (failure: Exception) {
                                sessionEditError = failure.message ?: "Unable to delete this session."
                            } finally {
                                sessionEditSaving = false
                            }
                        }
                    },
                    onAddDrill = { drill ->
                        scope.launch {
                            sessionDrillBusy = true
                            sessionEditError = ""
                            try {
                                val updated = api.addDrillToSession(token, session.id, drill.id)
                                sessions = sessions.map { if (it.id == updated.id) updated else it }
                            } catch (failure: Exception) {
                                sessionEditError = failure.message ?: "Unable to add this drill."
                            } finally {
                                sessionDrillBusy = false
                            }
                        }
                    },
                    onRemoveDrill = { drillId ->
                        scope.launch {
                            sessionDrillBusy = true
                            sessionEditError = ""
                            try {
                                val updated = api.removeDrillFromSession(token, session.id, drillId)
                                sessions = sessions.map { if (it.id == updated.id) updated else it }
                            } catch (failure: Exception) {
                                sessionEditError = failure.message ?: "Unable to remove this drill."
                            } finally {
                                sessionDrillBusy = false
                            }
                        }
                    },
                    onBack = { editingSession = null; tab = "Sessions" },
                    modifier = Modifier.weight(1f)
                ) }
            }
            "Schedule session" -> MaterialTheme(colorScheme = EkotaOverviewColors) { ScheduleSessionPanel(
                squads = squads,
                players = members.filter { it.role == "PLAYER" && it.invitationStatus == "ACTIVE" },
                coaches = members.filter { it.role == "COACH" && it.invitationStatus == "ACTIVE" },
                allDrills = drills + clubDrills,
                templates = templates,
                isSaving = scheduleSaving,
                saveError = scheduleError,
                onBack = { tab = "Sessions" },
                onSave = { payload ->
                    scope.launch {
                        scheduleSaving = true
                        scheduleError = ""
                        try {
                            payload.put("clubId", clubId)
                            api.scheduleClubSession(token, payload)
                            tab = "Sessions"
                            refresh()
                            notice = "Training session scheduled."
                        } catch (failure: Exception) {
                            scheduleError = failure.message ?: "Unable to schedule this session."
                        } finally {
                            scheduleSaving = false
                        }
                    }
                }
            ) }
            "Assessments" -> MaterialTheme(colorScheme = EkotaOverviewColors) { AssessmentsPanel(
                assessments,
                members.filter { it.role == "PLAYER" && it.invitationStatus == "ACTIVE" },
                onSchedule = { showScheduleAssessment = true },
                onStart = { assessment ->
                    scope.launch {
                        error = ""
                        notice = ""
                        try {
                            val started = api.updatePlayerAssessment(token, assessment.id, JSONObject().put("status", "IN_PROGRESS"))
                            assessments = assessments.map { if (it.id == started.id) started else it }
                            assessmentRunError = ""
                            activeAssessment = started
                            tab = "Assessment"
                        } catch (failure: Exception) {
                            error = failure.message ?: "Unable to start this assessment."
                        }
                    }
                },
                onOpen = { assessment ->
                    assessmentRunError = ""
                    activeAssessment = assessment
                    tab = "Assessment"
                },
                onEdit = { assessment ->
                    assessmentEditError = ""
                    editingAssessment = assessment
                    tab = "Edit assessment"
                },
                onDelete = { assessment ->
                    scope.launch {
                        error = ""
                        notice = ""
                        try {
                            api.deleteAssessment(token, assessment.id)
                            assessments = assessments.filterNot { it.id == assessment.id }
                            notice = "Assessment deleted."
                        } catch (failure: Exception) {
                            error = failure.message ?: "Unable to delete this assessment."
                        }
                    }
                },
                modifier = Modifier.weight(1f)
            ) }
            "Edit assessment" -> editingAssessment?.let { assessment ->
                MaterialTheme(colorScheme = EkotaOverviewColors) { EditAssessmentPanel(
                    assessment = assessment,
                    isSaving = assessmentEditSaving,
                    saveError = assessmentEditError,
                    onSave = { title, date, time ->
                        scope.launch {
                            assessmentEditSaving = true
                            assessmentEditError = ""
                            try {
                                val body = JSONObject().put("title", title).put("scheduledDate", date)
                                body.put("scheduledTime", time)
                                val updated = api.updatePlayerAssessment(
                                    token,
                                    assessment.id,
                                    body
                                )
                                assessments = assessments.map { if (it.id == updated.id) updated else it }
                                editingAssessment = null
                                tab = "Assessments"
                                notice = "Assessment changes saved."
                            } catch (failure: Exception) {
                                assessmentEditError = failure.message ?: "Unable to save assessment changes."
                            } finally {
                                assessmentEditSaving = false
                            }
                        }
                    },
                    onDelete = {
                        scope.launch {
                            assessmentEditSaving = true
                            assessmentEditError = ""
                            try {
                                api.deleteAssessment(token, assessment.id)
                                assessments = assessments.filterNot { it.id == assessment.id }
                                editingAssessment = null
                                tab = "Assessments"
                                notice = "Assessment deleted."
                            } catch (failure: Exception) {
                                assessmentEditError = failure.message ?: "Unable to delete this assessment."
                            } finally {
                                assessmentEditSaving = false
                            }
                        }
                    },
                    onBack = { editingAssessment = null; tab = "Assessments" },
                    modifier = Modifier.weight(1f)
                ) }
            }
            "Assessment" -> activeAssessment?.let { assessment ->
                MaterialTheme(colorScheme = EkotaOverviewColors) { AssessmentRunPanel(
                    assessment = assessment,
                    isSaving = assessmentRunSaving,
                    isGeneratingInsights = assessmentInsightsBusy,
                    error = assessmentRunError,
                    onSave = { metrics, strengths, focusAreas, coachFeedback, playerFeedback, complete ->
                        scope.launch {
                            assessmentRunSaving = true
                            assessmentRunError = ""
                            try {
                                val metricRows = JSONArray()
                                metrics.forEach { metric ->
                                    metricRows.put(
                                        JSONObject()
                                            .put("name", metric.name)
                                            .put("score", metric.score ?: JSONObject.NULL)
                                            .put("note", metric.note)
                                    )
                                }
                                val body = JSONObject()
                                    .put("metrics", metricRows)
                                    .put("strengths", strengths)
                                    .put("focusAreas", focusAreas)
                                    .put("coachFeedback", coachFeedback)
                                    .put("playerFeedback", playerFeedback)
                                if (complete) body.put("status", "COMPLETED")
                                val updated = api.updatePlayerAssessment(token, assessment.id, body)
                                assessments = assessments.map { if (it.id == updated.id) updated else it }
                                activeAssessment = updated
                                notice = if (complete) "Assessment completed for ${updated.playerName}." else "Assessment progress saved."
                            } catch (failure: Exception) {
                                assessmentRunError = failure.message ?: "Unable to save this assessment."
                            } finally {
                                assessmentRunSaving = false
                            }
                        }
                    },
                    onGenerateInsights = {
                        scope.launch {
                            assessmentInsightsBusy = true
                            assessmentRunError = ""
                            try {
                                val updated = api.generateAssessmentInsights(token, assessment.id)
                                assessments = assessments.map { if (it.id == updated.id) updated else it }
                                activeAssessment = updated
                                notice = "Assessment insights generated."
                            } catch (failure: Exception) {
                                assessmentRunError = failure.message ?: "Unable to generate assessment insights."
                            } finally {
                                assessmentInsightsBusy = false
                            }
                        }
                    },
                    onDownloadReport = {
                        if (!assessmentReportBusy) scope.launch {
                            assessmentReportBusy = true
                            assessmentRunError = ""
                            notice = "Preparing assessment report…"
                            try {
                                val file = downloadAssessmentReportPdf(context, api, token, assessment)
                                openClubExport(context, file, "application/pdf", "Open assessment report")
                                notice = ""
                            } catch (failure: CancellationException) {
                                throw failure
                            } catch (failure: Exception) {
                                notice = ""
                                assessmentRunError = failure.message ?: "Unable to create the assessment report."
                            } finally {
                                assessmentReportBusy = false
                            }
                        }
                    },
                    onShareReport = {
                        if (!assessmentReportBusy) scope.launch {
                            assessmentReportBusy = true
                            assessmentRunError = ""
                            notice = "Preparing assessment report…"
                            try {
                                val file = downloadAssessmentReportPdf(context, api, token, assessment)
                                shareClubExport(context, file, "application/pdf", "Share assessment report")
                                notice = ""
                            } catch (failure: CancellationException) {
                                throw failure
                            } catch (failure: Exception) {
                                notice = ""
                                assessmentRunError = failure.message ?: "Unable to create the assessment report."
                            } finally {
                                assessmentReportBusy = false
                            }
                        }
                    },
                    onBack = { activeAssessment = null; tab = "Assessments" },
                    modifier = Modifier.weight(1f),
                    videoCard = {
                        AssessmentVideoCard(
                            api = api,
                            token = token,
                            assessment = assessment,
                            driveConnected = driveConnected,
                            driveEmail = driveEmail,
                            onRefreshDrive = {
                                scope.launch {
                                    try {
                                        val (connected, email) = api.getGoogleDriveStatus(token)
                                        driveConnected = connected
                                        driveEmail = email.orEmpty()
                                    } catch (failure: Exception) {
                                        notice = failure.message ?: "Unable to refresh Google Drive status."
                                    }
                                }
                            },
                            onDisconnectDrive = {
                                api.disconnectGoogleDrive(token)
                                driveConnected = false
                                driveEmail = ""
                                driveVideos = emptyList()
                            },
                            onNotice = { notice = it }
                        )
                    }
                )
                }
            }
            "Reports" -> ClubReportsPanel(
                clubName = user.clubName ?: "Club",
                members = reportMembers,
                sessions = reportSessions,
                loadError = reportError,
                modifier = Modifier.weight(1f)
            )
            "Certificates" -> CertificatesPanel(
                certificates = certificates,
                canDelete = isClubAdmin,
                onDelete = { certificate ->
                    scope.launch {
                        error = ""
                        try {
                            api.deleteCertificate(token, certificate.id)
                            certificates = certificates.filterNot { it.id == certificate.id }
                            notice = "Certificate deleted."
                        } catch (failure: Exception) {
                            error = failure.message ?: "Unable to delete this certificate."
                        }
                    }
                },
                modifier = Modifier.weight(1f)
            )
            "Drills", "Club drills" -> ClubDrillsPanel(
                drills = catalogueDrills,
                canCreate = isClubCoach || isClubAdmin,
                onCreate = { title, discipline, skillSet, context, duration, instructions ->
                    scope.launch {
                        error = ""
                        try {
                            api.addClubDrill(
                                token,
                                JSONObject()
                                    .put("title", title)
                                    .put("discipline", discipline)
                                    .put("skillSet", skillSet)
                                    .put("contextType", context)
                                    .put("durationMinutes", duration)
                                    .put("instructions", instructions)
                                    .put("clubId", clubId)
                                    .put("clubName", user.clubName)
                            )
                            clubDrills = api.getClubDrills(token, clubId)
                            catalogueDrills = api.getDrills(token, clubId)
                            notice = "Club drill added to the catalogue."
                        } catch (failure: Exception) {
                            error = failure.message ?: "Unable to add this drill."
                        }
                    }
                },
                onClone = { drill ->
                    scope.launch {
                        error = ""
                        try {
                            api.cloneDrill(token, drill.id)
                            clubDrills = api.getClubDrills(token, clubId)
                            catalogueDrills = api.getDrills(token, clubId)
                            notice = "Drill cloned into your club catalogue."
                        } catch (failure: Exception) {
                            error = failure.message ?: "Unable to clone this drill."
                        }
                    }
                },
                onUpdate = { drill, title, discipline, skillSet, context, duration, instructions, imageUrl ->
                    scope.launch {
                        error = ""
                        try {
                            val updates = JSONObject()
                                .put("title", title)
                                .put("discipline", discipline)
                                .put("skillSet", skillSet)
                                .put("contextType", context)
                                .put("durationMinutes", duration)
                                .put("instructions", instructions)
                            if (imageUrl != drill.imageUrl) updates.put("imageUrl", imageUrl ?: JSONObject.NULL)
                            api.updateDrill(
                                token,
                                drill.id,
                                updates
                            )
                            clubDrills = api.getClubDrills(token, clubId)
                            catalogueDrills = api.getDrills(token, clubId)
                            notice = "Club drill updated."
                        } catch (failure: Exception) {
                            error = failure.message ?: "Unable to update this drill."
                        }
                    }
                },
                onDelete = { drill ->
                    scope.launch {
                        error = ""
                        try {
                            api.deleteDrill(token, drill.id)
                            clubDrills = api.getClubDrills(token, clubId)
                            catalogueDrills = api.getDrills(token, clubId)
                            notice = "Club drill deleted."
                        } catch (failure: Exception) {
                            error = failure.message ?: "Unable to delete this drill."
                        }
                    }
                },
                modifier = Modifier.weight(1f)
            )
            "Progression" -> ProgressionPanel(
                certificates = certificates,
                players = members.filter { it.role == "PLAYER" },
                onPromote = { selectedPromotionPlayer = it },
                modifier = Modifier.weight(1f)
            )
            "Video Analysis" -> MaterialTheme(colorScheme = EkotaOverviewColors) { VideoAnalysisPanel(
                api = api,
                token = token,
                players = members.filter { it.role == "PLAYER" && it.invitationStatus == "ACTIVE" },
                onRefreshDrive = {
                    scope.launch {
                        try {
                            val (connected, email) = api.getGoogleDriveStatus(token)
                            driveConnected = connected
                            driveEmail = email.orEmpty()
                            driveVideos = if (connected) api.listGoogleDriveVideos(token) else emptyList()
                            driveError = ""
                        } catch (failure: Exception) {
                            driveError = failure.message ?: "Unable to refresh Google Drive status."
                        }
                    }
                },
                driveConnected = driveConnected,
                driveEmail = driveEmail,
                driveVideos = driveVideos,
                driveError = driveError,
                onDisconnectDrive = {
                    scope.launch {
                        try {
                            api.disconnectGoogleDrive(token)
                            driveConnected = false
                            driveEmail = ""
                            driveVideos = emptyList()
                            driveError = ""
                            notice = "Google Drive disconnected."
                        } catch (failure: Exception) {
                            driveError = failure.message ?: "Unable to disconnect Google Drive."
                        }
                    }
                },
                modifier = Modifier.weight(1f)
            ) }
            "Settings" -> ClubSettingsPanel(
                logoUrl = clubLogo,
                onSave = { logoData ->
                    scope.launch {
                        error = ""
                        try {
                            api.updateClubBranding(token, logoData)
                            clubLogo = logoData
                            notice = "Club branding saved."
                        } catch (failure: Exception) {
                            error = failure.message ?: "Unable to save club branding."
                        }
                    }
                },
                modifier = Modifier.weight(1f)
            )
            else -> ReadOnlyTemplates(templates, Modifier.weight(1f))
        }
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
            IconButton(onClick = { scope.launch { drawerState.open() } }) {
                Icon(Icons.Outlined.Menu, contentDescription = "Open navigation", tint = MaterialTheme.colorScheme.primary)
            }
            WorkspaceAction(
                label = if (loading) "Syncing…" else "Sync",
                icon = Icons.Outlined.Sync,
                onClick = {
                    scope.launch {
                        synchronizeQueuedMutations()
                        refresh()
                    }
                },
                enabled = !loading
            )
        }
            }
        }
        if (!isTablet) {
            NavigationBar(
                containerColor = MaterialTheme.colorScheme.primary,
                contentColor = MaterialTheme.colorScheme.onPrimary,
                tonalElevation = 0.dp
            ) {
                bottomTabs.forEach { item ->
                    NavigationBarItem(
                        selected = sectionTab == item,
                        onClick = { tab = item },
                        icon = { Icon(workspaceTabIcon(item), contentDescription = null) },
                        label = { Text(item, fontSize = 11.sp, maxLines = 1) },
                        colors = NavigationBarItemDefaults.colors(
                            selectedIconColor = MaterialTheme.colorScheme.primary,
                            selectedTextColor = MaterialTheme.colorScheme.onPrimary,
                            indicatorColor = MaterialTheme.colorScheme.onPrimary,
                            unselectedIconColor = MaterialTheme.colorScheme.onPrimary.copy(alpha = 0.7f),
                            unselectedTextColor = MaterialTheme.colorScheme.onPrimary.copy(alpha = 0.7f)
                        )
                    )
                }
            }
        }
        }
        }
        }
    }

    if (showInvite) {
        InviteMemberDialog(
            onDismiss = { showInvite = false },
            onSave = { name, email, role, ageGroup, discipline ->
                scope.launch {
                    error = ""
                    notice = ""
                    try {
                        api.inviteClubMember(
                            token,
                            JSONObject()
                                .put("name", name)
                                .put("email", email)
                                .put("role", role)
                                .put("ageGroup", ageGroup)
                                .put("discipline", discipline)
                                .put("clubId", clubId)
                        )
                        showInvite = false
                        refresh()
                        notice = "Invitation sent to $email."
                    } catch (failure: Exception) {
                        error = failure.message ?: "Unable to invite this member."
                    }
                }
            }
        )
    }
    if (showCreateSquad) {
        CreateSquadDialog(
            onDismiss = { showCreateSquad = false },
            onSave = { name, ageGroup, disciplines ->
                scope.launch {
                    error = ""
                    try {
                        api.createSquad(
                            token,
                            JSONObject()
                                .put("name", name)
                                .put("ageGroup", ageGroup)
                                .put("discipline", JSONArray(disciplines))
                                .put("memberIds", JSONArray())
                                .put("clubId", clubId)
                        )
                        showCreateSquad = false
                        refresh()
                        notice = "Squad created."
                    } catch (failure: Exception) {
                        error = failure.message ?: "Unable to create squad."
                    }
                }
            }
        )
    }
    if (showScheduleAssessment) {
        ScheduleAssessmentDialog(
            players = members.filter { it.role == "PLAYER" && it.invitationStatus == "ACTIVE" },
            onDismiss = { showScheduleAssessment = false },
            onSave = { player, title, date, time, discipline ->
                scope.launch {
                    error = ""
                    try {
                        val body = JSONObject()
                            .put("title", title)
                            .put("playerId", player.id)
                            .put("discipline", discipline)
                            .put("scheduledDate", date)
                        if (time.isNotBlank()) body.put("scheduledTime", time)
                        api.schedulePlayerAssessment(
                            token,
                            body
                        )
                        showScheduleAssessment = false
                        refresh()
                        notice = "Assessment scheduled for ${player.name}."
                    } catch (failure: Exception) {
                        error = failure.message ?: "Unable to schedule this assessment."
                    }
                }
            }
        )
    }
    selectedPromotionPlayer?.let { player ->
        PromotePlayerDialog(
            player = player,
            onDismiss = { selectedPromotionPlayer = null },
            onSave = { nextLevel, notes ->
                scope.launch {
                    error = ""
                    try {
                        api.promotePlayer(token, player.id, nextLevel, user.name, notes)
                        selectedPromotionPlayer = null
                        refresh()
                        notice = "${player.name} promoted to $nextLevel."
                    } catch (failure: Exception) {
                        error = failure.message ?: "Unable to promote this player."
                    }
                }
            }
        )
    }
    discardMutation?.let { mutation ->
        AlertDialog(
            onDismissRequest = { discardMutation = null },
            title = { Text("Discard this failed edit?") },
            text = { Text("This permanently removes the encrypted queued change for ${mutation.resourceId}. It will not be sent to the server.") },
            confirmButton = {
                Button(onClick = {
                    store.removeQueuedMutation(mutation.id)
                    discardMutation = null
                    reloadQueue()
                }) { Text("Discard edit") }
            },
            dismissButton = { TextButton(onClick = { discardMutation = null }) { Text("Keep edit") } }
        )
    }
}

@Composable
private fun ClubWorkspaceSidebar(
    user: CoachUser,
    tabs: List<String>,
    selectedTab: String,
    collapsed: Boolean,
    onToggleCollapsed: () -> Unit,
    onSelectTab: (String) -> Unit
) {
    val sidebar = Color(0xFF111A35)
    val width = if (collapsed) 76.dp else 224.dp
    Column(
        Modifier.fillMaxHeight().width(width).background(sidebar).padding(horizontal = if (collapsed) 8.dp else 12.dp, vertical = 12.dp)
    ) {
        if (collapsed) {
            Box(Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
                Surface(shape = RoundedCornerShape(12.dp), color = MaterialTheme.colorScheme.primary, modifier = Modifier.size(42.dp)) {
                    Box(contentAlignment = Alignment.Center) {
                        Icon(Icons.Outlined.SportsCricket, contentDescription = "Ekota Academy", tint = MaterialTheme.colorScheme.onPrimary, modifier = Modifier.size(24.dp))
                    }
                }
            }
            IconButton(onClick = onToggleCollapsed, modifier = Modifier.align(Alignment.CenterHorizontally).padding(top = 4.dp)) {
                Icon(Icons.AutoMirrored.Outlined.KeyboardArrowRight, contentDescription = "Expand navigation", tint = Color.White)
            }
        } else {
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                Surface(shape = RoundedCornerShape(12.dp), color = MaterialTheme.colorScheme.primary, modifier = Modifier.size(42.dp)) {
                    Box(contentAlignment = Alignment.Center) {
                        Icon(Icons.Outlined.SportsCricket, contentDescription = null, tint = MaterialTheme.colorScheme.onPrimary, modifier = Modifier.size(24.dp))
                    }
                }
                Column(Modifier.weight(1f).padding(start = 10.dp)) {
                    Text("Ekota", color = Color.White, fontWeight = FontWeight.ExtraBold, fontSize = 15.sp)
                    Text("Academy", color = Color.White.copy(alpha = 0.75f), fontSize = 12.sp)
                }
                IconButton(onClick = onToggleCollapsed) {
                    Icon(Icons.AutoMirrored.Outlined.KeyboardArrowRight, contentDescription = "Collapse navigation", tint = Color.White, modifier = Modifier.graphicsLayer(scaleX = -1f))
                }
            }
        }
        Column(Modifier.weight(1f).fillMaxWidth().verticalScroll(rememberScrollState())) {
            Spacer(Modifier.height(22.dp))
            tabs.forEach { tab ->
                val selected = selectedTab == tab
                val selectedBrush = Brush.horizontalGradient(listOf(Color(0xFF7527F5), Color(0xFF3448DF)))
                Box(
                    Modifier.fillMaxWidth().height(44.dp).clip(RoundedCornerShape(24.dp))
                        .background(if (selected) selectedBrush else Brush.horizontalGradient(listOf(Color.Transparent, Color.Transparent)))
                        .clickable { onSelectTab(tab) }
                        .padding(horizontal = if (collapsed) 0.dp else 14.dp),
                    contentAlignment = Alignment.CenterStart
                ) {
                    Row(
                        Modifier.fillMaxWidth(),
                        horizontalArrangement = if (collapsed) Arrangement.Center else Arrangement.Start,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Icon(
                            workspaceTabIcon(tab),
                            contentDescription = if (collapsed) tab else null,
                            tint = if (selected) Color.White else Color(0xFFD2D8EB),
                            modifier = Modifier.size(21.dp)
                        )
                        if (!collapsed) {
                            Text(tab, color = if (selected) Color.White else Color(0xFFD2D8EB), fontWeight = if (selected) FontWeight.Bold else FontWeight.Medium, fontSize = 13.sp, maxLines = 1, modifier = Modifier.padding(start = 12.dp))
                        }
                    }
                }
                Spacer(Modifier.height(5.dp))
            }
        }
        Row(
            Modifier.fillMaxWidth().padding(horizontal = if (collapsed) 4.dp else 6.dp, vertical = 5.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = if (collapsed) Arrangement.Center else Arrangement.Start
        ) {
            val initials = user.name.split(Regex("\\s+")).filter(String::isNotBlank).take(2).mapNotNull { it.firstOrNull()?.uppercaseChar() }.joinToString("").ifBlank { "U" }
            Surface(shape = CircleShape, color = Color(0xFF8A65F5), modifier = Modifier.size(38.dp)) {
                Box(contentAlignment = Alignment.Center) { Text(initials, color = Color.White, fontWeight = FontWeight.Bold, fontSize = 13.sp) }
            }
            if (!collapsed) {
                Column(Modifier.weight(1f).padding(start = 9.dp)) {
                    Text(user.name, color = Color.White, fontWeight = FontWeight.SemiBold, fontSize = 12.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
                    Text(if (user.role == "CLUB_ADMIN") "Club Admin" else "Coach", color = Color(0xFFBEC7DE), fontSize = 11.sp)
                }
            }
        }
    }
}

@Composable
private fun EkotaWorkspaceHeader(
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
    MaterialTheme(colorScheme = EkotaOverviewColors) {
        val isOverview = tab == "Overview"
        val pageTitle = when (tab) {
            "Sessions", "Edit session", "Schedule session" -> "Training Sessions"
            "Assessments", "Edit assessment", "Assessment" -> "Player Assessments"
            "Edit squad" -> "Squads"
            "Delivered sessions" -> "Delivered Sessions"
            else -> tab
        }
        val pageIconLabel = when (tab) {
            "Sessions", "Edit session", "Schedule session", "Delivered sessions" -> "Sessions"
            "Assessments", "Edit assessment", "Assessment" -> "Assessments"
            "Edit squad" -> "Squads"
            "Participants" -> "Members"
            else -> tab
        }
        val pageDescription = when (tab) {
            "Video Analysis" -> "Review technique with detailed CAPE pose, ball and speed measurements."
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
        val greeting = when (LocalTime.now().hour) {
            in 5..11 -> "Good morning,"
            in 12..16 -> "Good afternoon,"
            else -> "Good evening,"
        }
        Column(Modifier.fillMaxWidth().padding(vertical = 4.dp), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                if (isOverview && activeSession == null) {
                    Text(greeting, color = EkotaOverviewColors.onSurface.copy(alpha = 0.72f), fontSize = 17.sp, modifier = Modifier.weight(1f))
                } else {
                    Spacer(Modifier.weight(1f))
                }
                IconButton(onClick = onToggleTheme, modifier = Modifier.size(38.dp)) {
                    Icon(if (isDark) Icons.Outlined.LightMode else Icons.Outlined.DarkMode, contentDescription = if (isDark) "Switch to light theme" else "Switch to dark theme", tint = EkotaOverviewColors.primary)
                }
                IconButton(onClick = onSignOut, modifier = Modifier.size(38.dp)) {
                    Icon(Icons.AutoMirrored.Outlined.Logout, contentDescription = "Sign out", tint = EkotaOverviewColors.onSurface)
                }
            }
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.weight(1f)) {
                    if (activeSession != null) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Surface(
                                shape = CircleShape,
                                color = EkotaOverviewColors.surface,
                                border = BorderStroke(1.dp, EkotaOverviewColors.primary.copy(alpha = 0.18f)),
                                modifier = Modifier.size(44.dp)
                            ) {
                                Box(contentAlignment = Alignment.Center) {
                                    IconButton(onClick = { onSessionBack?.invoke() }) {
                                        Icon(
                                            Icons.AutoMirrored.Outlined.ArrowBack,
                                            contentDescription = "Back",
                                            tint = EkotaOverviewColors.primary,
                                            modifier = Modifier.size(24.dp)
                                        )
                                    }
                                }
                            }
                            Column(Modifier.weight(1f).padding(start = 8.dp), verticalArrangement = Arrangement.spacedBy(3.dp)) {
                                Text(
                                    activeSessionPageTitle ?: activeSession.title,
                                    color = EkotaOverviewColors.onSurface,
                                    fontSize = 23.sp,
                                    fontWeight = FontWeight.ExtraBold,
                                    maxLines = 1,
                                    overflow = TextOverflow.Ellipsis
                                )
                                Text(
                                    if (activeSessionPageTitle != null) {
                                        "${activeSession.title}  ·  ${activeSession.sessionDate}  ·  ${activeSession.durationMinutes} min  ·  ${activeSession.squadName}"
                                    } else {
                                        "${activeSession.sessionDate}  ·  ${activeSession.durationMinutes} min  ·  ${activeSession.squadName}"
                                    },
                                    color = EkotaOverviewColors.onSurfaceVariant,
                                    fontSize = 12.sp,
                                    maxLines = 2,
                                    overflow = TextOverflow.Ellipsis
                                )
                            }
                        }
                    } else if (activeAssessment != null) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Surface(
                                shape = CircleShape,
                                color = EkotaOverviewColors.surface,
                                border = BorderStroke(1.dp, EkotaOverviewColors.primary.copy(alpha = 0.18f)),
                                modifier = Modifier.size(44.dp)
                            ) {
                                Box(contentAlignment = Alignment.Center) {
                                    IconButton(onClick = onAssessmentBack) {
                                        Icon(Icons.AutoMirrored.Outlined.ArrowBack, contentDescription = "Back to assessments", tint = EkotaOverviewColors.primary, modifier = Modifier.size(24.dp))
                                    }
                                }
                            }
                            Column(Modifier.weight(1f).padding(start = 8.dp), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                                Text(
                                    "${activeAssessment.playerName} · ${activeAssessment.discipline}".uppercase(),
                                    color = EkotaOverviewColors.primary,
                                    fontSize = 14.sp,
                                    fontWeight = FontWeight.SemiBold,
                                    maxLines = 1,
                                    overflow = TextOverflow.Ellipsis
                                )
                                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                                    Text(
                                        activeAssessment.title,
                                        color = EkotaOverviewColors.onSurface,
                                        fontSize = 23.sp,
                                        fontWeight = FontWeight.ExtraBold,
                                        maxLines = 1,
                                        overflow = TextOverflow.Ellipsis,
                                        modifier = Modifier.weight(1f, fill = false)
                                    )
                                    Text(
                                        activeAssessment.status.replace('_', ' '),
                                        color = EkotaOverviewColors.primary,
                                        fontSize = 12.sp,
                                        fontWeight = FontWeight.SemiBold,
                                        modifier = Modifier
                                            .background(EkotaOverviewColors.primary.copy(alpha = 0.12f), RoundedCornerShape(50))
                                            .padding(horizontal = 10.dp, vertical = 4.dp)
                                    )
                                }
                                Text(
                                    activeAssessment.scheduledDate +
                                        (activeAssessment.scheduledTime?.let { " at $it" } ?: "") +
                                        (activeAssessment.coachName.takeIf(String::isNotBlank)?.let { " · Coach $it" } ?: ""),
                                    color = EkotaOverviewColors.onSurfaceVariant,
                                    fontSize = 14.sp,
                                    maxLines = 1,
                                    overflow = TextOverflow.Ellipsis
                                )
                            }
                        }
                    } else if (isOverview) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Text(user.name, color = EkotaOverviewColors.onSurface, fontSize = 32.sp, fontWeight = FontWeight.ExtraBold, maxLines = 1, overflow = TextOverflow.Ellipsis)
                            Text(" 👋", fontSize = 24.sp)
                        }
                        Text("Let’s plan, coach and grow together.", color = EkotaOverviewColors.onSurface.copy(alpha = 0.72f), fontSize = 15.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
                    } else {
                        Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                                Icon(workspaceTabIcon(pageIconLabel), contentDescription = null, tint = EkotaOverviewColors.primary, modifier = Modifier.size(29.dp))
                                Text(pageTitle, color = EkotaOverviewColors.onSurface, fontSize = 32.sp, fontWeight = FontWeight.ExtraBold, maxLines = 1, overflow = TextOverflow.Ellipsis)
                            }
                            Text(pageDescription, color = EkotaOverviewColors.onSurface.copy(alpha = 0.72f), fontSize = 15.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
                        }
                    }
                }
                Surface(
                    shape = RoundedCornerShape(24.dp),
                    color = EkotaOverviewColors.surface,
                    border = BorderStroke(1.dp, EkotaOverviewColors.primary.copy(alpha = 0.18f)),
                    modifier = Modifier.padding(start = 8.dp)
                ) {
                    Row(Modifier.padding(horizontal = 11.dp, vertical = 8.dp), verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Outlined.Groups, contentDescription = null, tint = EkotaOverviewColors.primary, modifier = Modifier.size(18.dp))
                        Text(user.clubName ?: "Ekota Academy", color = EkotaOverviewColors.onSurface, fontWeight = FontWeight.Bold, fontSize = 13.sp, maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.padding(start = 6.dp))
                        Icon(Icons.Outlined.ExpandMore, contentDescription = null, tint = EkotaOverviewColors.onSurface, modifier = Modifier.padding(start = 4.dp).size(17.dp))
                    }
                }
            }
        }
        HorizontalDivider(color = EkotaOverviewColors.outline.copy(alpha = 0.8f))
    }
}

private fun workspaceSectionFor(tab: String): String = when (tab) {
    "Delivered sessions", "Participants" -> "Overview"
    "Edit squad" -> "Squads"
    "Edit session", "Schedule session" -> "Sessions"
    "Edit assessment", "Assessment" -> "Assessments"
    else -> tab
}

private fun workspaceTabIcon(label: String): androidx.compose.ui.graphics.vector.ImageVector = when (label) {
    "Overview" -> Icons.Outlined.Dashboard
    "Members" -> Icons.Outlined.Group
    "Squads" -> Icons.Outlined.Groups
    "Sessions" -> Icons.Outlined.CalendarMonth
    "Assessments" -> Icons.Outlined.Assignment
    "Reports" -> Icons.Outlined.BarChart
    "Certificates" -> Icons.Outlined.WorkspacePremium
    "Drills" -> Icons.Outlined.FitnessCenter
    "Club drills" -> Icons.Outlined.LibraryBooks
    "Templates" -> Icons.Outlined.Description
    "Progression" -> Icons.Outlined.TrendingUp
    "Video Analysis" -> Icons.Outlined.Videocam
    "Settings" -> Icons.Outlined.Settings
    else -> Icons.Outlined.Dashboard
}

@Composable
private fun WorkspaceTab(label: String, selected: Boolean, onClick: () -> Unit) {
    Surface(
        onClick = onClick,
        color = if (selected) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.surfaceVariant,
        shape = RoundedCornerShape(18.dp),
        tonalElevation = if (selected) 6.dp else 0.dp,
        shadowElevation = if (selected) 4.dp else 0.dp
    ) {
        Row(
            modifier = Modifier.padding(horizontal = 14.dp, vertical = 10.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(6.dp)
        ) {
            Icon(
                workspaceTabIcon(label),
                contentDescription = null,
                tint = if (selected) MaterialTheme.colorScheme.onPrimary else MaterialTheme.colorScheme.onSurface.copy(alpha = 0.7f),
                modifier = Modifier.height(16.dp)
            )
            Text(
                label,
                color = if (selected) MaterialTheme.colorScheme.onPrimary else MaterialTheme.colorScheme.onSurface,
                fontWeight = FontWeight.SemiBold,
                fontSize = 13.sp
            )
        }
    }
}

@Composable
private fun OverviewPanel(
    userId: String,
    isClubAdmin: Boolean,
    members: List<ClubMember>,
    squads: List<ClubSquad>,
    sessions: List<ClubTrainingSession>,
    drills: List<Drill>,
    assessments: List<PlayerAssessment>,
    loading: Boolean,
    onOpen: (String) -> Unit,
    onExecute: (ClubTrainingSession) -> Unit,
    modifier: Modifier = Modifier
) {
    val today = LocalDate.now().toString()
    // Matches the web app's CoachOperations dashboard: "upcoming" means not yet executed,
    // with no date restriction (overdue, undelivered sessions still count as upcoming).
    val upcomingSessions = sessions
        .filter { !it.isExecuted }
        .sortedBy { it.sessionDate }
    val myUpcomingSessions = upcomingSessions.filter { it.isAssignedTo(userId) }
    // Club admins oversee every session rather than being assigned to them, so they see the club total.
    val sessionCount = if (isClubAdmin) upcomingSessions.size else myUpcomingSessions.size
    val upcomingAssessments = assessments
        .filter { it.status != "COMPLETED" && it.scheduledDate >= today }
        .sortedBy { it.scheduledDate }
    val deliveredSessions = sessions.count { it.isExecuted }
    val quickActions = buildList {
        add(OverviewQuickAction("Create session", Icons.Outlined.CalendarMonth, Color(0xFF6124EB), Color(0xFF8961F2), "Schedule session"))
        add(OverviewQuickAction("Add participant", Icons.Outlined.Group, Color(0xFF1485F1), Color(0xFF53A4FC), if (isClubAdmin) "Members" else "Participants"))
        add(OverviewQuickAction("New assessment", Icons.Outlined.Assignment, Color(0xFF0FA675), Color(0xFF32C997), "Assessments"))
        add(OverviewQuickAction("View reports", Icons.Outlined.BarChart, Color(0xFFF0762B), Color(0xFFFFA344), "Reports"))
    }
    BoxWithConstraints(modifier) {
        val isTablet = maxWidth >= 600.dp
        LazyColumn(Modifier.fillMaxSize(), verticalArrangement = Arrangement.spacedBy(14.dp)) {
        if (isTablet) {
            item {
                Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    OverviewMetricCard("Sessions", sessionCount.toString(), "Scheduled or ready to deliver", Icons.Outlined.CalendarMonth, Color(0xFF7448EF), Modifier.weight(1f)) { onOpen("Sessions") }
                    OverviewMetricCard("Assessments", upcomingAssessments.size.toString(), "Due or in progress", Icons.Outlined.Assignment, Color(0xFF248AF2), Modifier.weight(1f)) { onOpen("Assessments") }
                }
            }
            item {
                Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    OverviewMetricCard("Delivered sessions", deliveredSessions.toString(), "Current coaching season", Icons.Outlined.CheckCircle, Color(0xFF12A875), Modifier.weight(1f)) { onOpen("Delivered sessions") }
                    OverviewMetricCard("Active participants", members.count { it.role == "PLAYER" && it.invitationStatus == "ACTIVE" }.toString(), "Players in your club", Icons.Outlined.Group, Color(0xFFF1842D), Modifier.weight(1f)) { onOpen("Participants") }
                }
            }
            item {
                Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    OverviewList("Next sessions and events", upcomingSessions.take(1), Modifier.weight(1f), headerIcon = Icons.Outlined.CalendarMonth, onRowClick = { onOpen("Sessions") }, onViewAll = { onOpen("Sessions") }) { session ->
                        OverviewSessionContent(session, drills.firstOrNull { it.id in session.drillIds && !it.imageUrl.isNullOrBlank() })
                    }
                    OverviewList("My upcoming sessions", myUpcomingSessions.take(1), Modifier.weight(1f), headerIcon = Icons.Outlined.AccessTime, onRowClick = onExecute, onViewAll = { onOpen("Sessions") }) { session ->
                        OverviewSessionContent(session, drills.firstOrNull { it.id in session.drillIds && !it.imageUrl.isNullOrBlank() })
                    }
                }
            }
        } else {
            item { OverviewMetricCard("Sessions", sessionCount.toString(), "Scheduled or ready to deliver", Icons.Outlined.CalendarMonth, Color(0xFF7448EF)) { onOpen("Sessions") } }
            item { OverviewMetricCard("Assessments", upcomingAssessments.size.toString(), "Due or in progress", Icons.Outlined.Assignment, Color(0xFF248AF2)) { onOpen("Assessments") } }
            item { OverviewMetricCard("Delivered sessions", deliveredSessions.toString(), "Current coaching season", Icons.Outlined.CheckCircle, Color(0xFF12A875)) { onOpen("Delivered sessions") } }
            item { OverviewMetricCard("Active participants", members.count { it.role == "PLAYER" && it.invitationStatus == "ACTIVE" }.toString(), "Players in your club", Icons.Outlined.Group, Color(0xFFF1842D)) { onOpen("Participants") } }
            item { OverviewList("Next sessions and events", upcomingSessions.take(1), headerIcon = Icons.Outlined.CalendarMonth, onRowClick = { onOpen("Sessions") }, onViewAll = { onOpen("Sessions") }) { session ->
                OverviewSessionContent(session, drills.firstOrNull { it.id in session.drillIds && !it.imageUrl.isNullOrBlank() })
            } }
            item { OverviewList("My upcoming sessions", myUpcomingSessions.take(1), headerIcon = Icons.Outlined.AccessTime, onRowClick = onExecute, onViewAll = { onOpen("Sessions") }) { session ->
                OverviewSessionContent(session, drills.firstOrNull { it.id in session.drillIds && !it.imageUrl.isNullOrBlank() })
            } }
        }
        item {
            Surface(
                modifier = Modifier.fillMaxWidth(),
                color = Color(0xFFEDEBFF),
                shape = RoundedCornerShape(18.dp)
            ) {
                Column(Modifier.fillMaxWidth().padding(13.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Outlined.Bolt, contentDescription = null, tint = Color(0xFF762EF0), modifier = Modifier.size(25.dp))
                        Text("  Quick actions", color = Color(0xFF171D37), fontSize = 17.sp, fontWeight = FontWeight.ExtraBold)
                    }
                    if (isTablet) {
                        Row(horizontalArrangement = Arrangement.spacedBy(9.dp)) {
                            quickActions.forEach { action ->
                                OverviewQuickActionCard(action, Modifier.weight(1f)) { onOpen(action.destination) }
                            }
                        }
                    } else {
                        quickActions.chunked(2).forEach { row ->
                            Row(horizontalArrangement = Arrangement.spacedBy(9.dp)) {
                                row.forEach { action -> OverviewQuickActionCard(action, Modifier.weight(1f)) { onOpen(action.destination) } }
                                if (row.size == 1) Spacer(Modifier.weight(1f))
                            }
                        }
                    }
                }
            }
        }
        item {
            Surface(
                modifier = Modifier.fillMaxWidth(),
                color = Color(0xFFEDEBFF),
                shape = RoundedCornerShape(18.dp)
            ) {
                Column(Modifier.fillMaxWidth().padding(13.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Outlined.LibraryBooks, contentDescription = null, tint = Color(0xFF762EF0), modifier = Modifier.size(25.dp))
                        Text("  Coaching practice library", color = Color(0xFF171D37), fontSize = 17.sp, fontWeight = FontWeight.ExtraBold)
                    }
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        LibraryLink("ECB coaching resources")
                        LibraryLink("ICC development guidance")
                    }
                }
            }
        }
        if (loading && members.isEmpty() && sessions.isEmpty()) {
            item { Text("Loading club data…", color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.7f)) }
        }
    }
}
}

@Composable
private fun OverviewMetricCard(
    title: String,
    value: String,
    detail: String,
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    accent: Color,
    modifier: Modifier = Modifier,
    onClick: () -> Unit
) {
    BoxWithConstraints(modifier) {
        val scale = (maxWidth.value / 356f).coerceIn(0.9f, 1.12f)
        Card(
            modifier = Modifier.fillMaxWidth(),
            onClick = onClick,
            colors = CardDefaults.cardColors(containerColor = accent.copy(alpha = 0.14f)),
            shape = RoundedCornerShape(18.dp * scale),
            elevation = CardDefaults.cardElevation(defaultElevation = 0.dp)
        ) {
            Row(
                Modifier.fillMaxWidth()
                    .heightIn(min = 74.dp * scale)
                    .padding(horizontal = 14.dp * scale, vertical = 11.dp * scale),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Surface(color = accent, shape = RoundedCornerShape(12.dp * scale), modifier = Modifier.size(42.dp * scale)) {
                    Box(contentAlignment = Alignment.Center) {
                        Icon(icon, contentDescription = null, tint = Color.White, modifier = Modifier.size(21.dp * scale))
                    }
                }
                Column(Modifier.weight(1f).padding(start = 12.dp * scale)) {
                    Text(title, color = Color(0xFF17203B), fontWeight = FontWeight.ExtraBold, fontSize = 16.sp * scale)
                    Text(detail, color = Color(0xFF56617D), fontSize = 13.sp * scale, maxLines = 1, overflow = TextOverflow.Ellipsis)
                }
                Text(value, color = accent, fontSize = 29.sp * scale, fontWeight = FontWeight.ExtraBold, modifier = Modifier.padding(start = 6.dp * scale))
                Box(
                    Modifier.padding(start = 8.dp * scale).size(22.dp * scale).background(accent.copy(alpha = 0.1f), CircleShape),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(Icons.AutoMirrored.Outlined.KeyboardArrowRight, contentDescription = null, tint = accent, modifier = Modifier.size(17.dp * scale))
                }
            }
        }
    }
}

@Composable
private fun OverviewQuickActionCard(action: OverviewQuickAction, modifier: Modifier = Modifier, onClick: () -> Unit) {
    Surface(
        onClick = onClick,
        modifier = modifier,
        shape = RoundedCornerShape(15.dp),
        color = Color.Transparent,
        shadowElevation = 2.dp
    ) {
        Row(
            Modifier.fillMaxWidth().height(56.dp)
                .background(Brush.horizontalGradient(listOf(action.color, action.endColor)), RoundedCornerShape(15.dp))
                .padding(horizontal = 12.dp, vertical = 10.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Box(Modifier.size(27.dp)) {
                Icon(action.icon, contentDescription = null, tint = Color.White, modifier = Modifier.fillMaxSize())
                val badge = when (action.label) {
                    "Create session", "Add participant" -> "+"
                    "New assessment" -> "✓"
                    else -> null
                }
                badge?.let {
                    Surface(modifier = Modifier.align(Alignment.TopEnd).size(12.dp), color = Color.White, shape = CircleShape) {
                        Box(contentAlignment = Alignment.Center) {
                            Text(it, color = action.color, fontSize = 9.sp, lineHeight = 9.sp, fontWeight = FontWeight.ExtraBold)
                        }
                    }
                }
            }
            Text(action.label, color = Color.White, fontSize = 14.sp, fontWeight = FontWeight.Bold, maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.weight(1f))
            Box(Modifier.size(23.dp).background(Color.White.copy(alpha = 0.22f), CircleShape), contentAlignment = Alignment.Center) {
                Icon(Icons.AutoMirrored.Outlined.KeyboardArrowRight, contentDescription = null, tint = Color.White, modifier = Modifier.size(22.dp))
            }
        }
    }
}

@Composable
private fun <T> OverviewList(
    title: String,
    rows: List<T>,
    modifier: Modifier = Modifier,
    onRowClick: ((T) -> Unit)? = null,
    headerIcon: androidx.compose.ui.graphics.vector.ImageVector? = null,
    onViewAll: (() -> Unit)? = null,
    content: @Composable (T) -> Unit
) {
    Surface(
        modifier = modifier.fillMaxWidth(),
        color = MaterialTheme.colorScheme.surface,
        shape = RoundedCornerShape(18.dp),
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.primary.copy(alpha = 0.10f)),
        shadowElevation = 3.dp
    ) {
        Column(Modifier.fillMaxWidth().padding(10.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                headerIcon?.let { Icon(it, contentDescription = null, tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(24.dp)) }
                Text(title, color = MaterialTheme.colorScheme.onSurface, fontSize = 16.sp, fontWeight = FontWeight.ExtraBold, modifier = Modifier.weight(1f).padding(start = if (headerIcon != null) 7.dp else 0.dp))
                if (onViewAll != null) Text("View all →", color = MaterialTheme.colorScheme.primary, fontSize = 13.sp, fontWeight = FontWeight.SemiBold, modifier = Modifier.clickable(onClick = onViewAll))
            }
            if (rows.isEmpty()) {
                Text("Nothing scheduled.", color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f), fontSize = 13.sp, modifier = Modifier.padding(vertical = 12.dp))
            } else {
                rows.forEach { row ->
                    val sessionCard = @Composable {
                        Column(Modifier.fillMaxWidth().padding(3.dp)) { content(row) }
                    }
                    if (onRowClick != null) {
                        Card(
                            modifier = Modifier.fillMaxWidth(),
                            onClick = { onRowClick(row) },
                            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                            shape = RoundedCornerShape(13.dp),
                            elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
                        ) { sessionCard() }
                    } else {
                        Card(
                            modifier = Modifier.fillMaxWidth(),
                            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                            shape = RoundedCornerShape(13.dp),
                            elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
                        ) { sessionCard() }
                    }
                }
            }
        }
    }
}

@Composable
private fun OverviewSessionContent(session: ClubTrainingSession, drill: Drill?) {
    val thumbnail = drill?.imageUrl?.let(::overviewDrillImageSource)
    val sessionDate = runCatching { LocalDate.parse(session.sessionDate).format(DateTimeFormatter.ofPattern("EEE, dd MMM yyyy", Locale.getDefault())) }
        .getOrDefault(session.sessionDate)
    Row(
        Modifier.fillMaxWidth().padding(10.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(11.dp)
    ) {
        Box(Modifier.size(width = 72.dp, height = 92.dp).clip(RoundedCornerShape(8.dp))) {
            if (thumbnail != null) {
                AsyncImage(
                    model = thumbnail,
                    contentDescription = drill?.title ?: "Session drill",
                    contentScale = androidx.compose.ui.layout.ContentScale.Crop,
                    modifier = Modifier.fillMaxSize()
                )
            } else {
                Box(Modifier.fillMaxSize().background(Brush.verticalGradient(listOf(Color(0xFF18223B), Color(0xFF435171)))), contentAlignment = Alignment.Center) {
                    Icon(Icons.Outlined.SportsCricket, contentDescription = null, tint = Color.White.copy(alpha = 0.9f), modifier = Modifier.size(36.dp))
                }
            }
        }
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text(session.title, color = MaterialTheme.colorScheme.onSurface, fontWeight = FontWeight.ExtraBold, fontSize = 16.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(5.dp)) {
                    Icon(Icons.Outlined.Group, contentDescription = null, tint = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.58f), modifier = Modifier.size(19.dp))
                Text(session.squadName, color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.72f), fontSize = 13.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
                Icon(Icons.Outlined.AccessTime, contentDescription = null, tint = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.58f), modifier = Modifier.padding(start = 4.dp).size(16.dp))
                Text("${session.durationMinutes} min", color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.72f), fontSize = 13.sp, maxLines = 1)
            }
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(Icons.Filled.Person, contentDescription = null, tint = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.55f), modifier = Modifier.size(18.dp))
                Text("  Led by ${session.coachName ?: session.coachId ?: "Coach"}", color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.58f), fontSize = 12.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
            }
            Surface(color = Color(0xFFE8EEFF), shape = RoundedCornerShape(7.dp), modifier = Modifier.padding(top = 2.dp)) {
                Row(Modifier.padding(horizontal = 7.dp, vertical = 4.dp), verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Outlined.CalendarMonth, contentDescription = null, tint = Color(0xFF3159D8), modifier = Modifier.size(18.dp))
                    Text("  $sessionDate", color = Color(0xFF3159D8), fontWeight = FontWeight.Bold, fontSize = 12.sp)
                }
            }
        }
        Box(Modifier.size(28.dp).background(Color(0xFFE8EEFF), CircleShape), contentAlignment = Alignment.Center) {
            Icon(Icons.AutoMirrored.Outlined.KeyboardArrowRight, contentDescription = "Open session", tint = Color(0xFF3159D8), modifier = Modifier.size(24.dp))
        }
    }
}

private fun overviewDrillImageSource(url: String): String = when {
    url.startsWith("http://") || url.startsWith("https://") || url.startsWith("data:") -> url
    else -> BuildConfig.API_BASE_URL.trimEnd('/') + "/" + url.trimStart('/')
}

@Composable
private fun LibraryLink(label: String) {
    Surface(
        color = MaterialTheme.colorScheme.surface,
        shape = RoundedCornerShape(14.dp),
        tonalElevation = 3.dp
    ) {
        Text(label, color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.75f), fontSize = 13.sp, modifier = Modifier.padding(12.dp))
    }
}

@Composable
private fun SummaryCard(
    title: String,
    value: String,
    detail: String,
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    modifier: Modifier = Modifier,
    onClick: (() -> Unit)? = null
) {
    Card(
        modifier = modifier,
        onClick = { onClick?.invoke() },
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        shape = RoundedCornerShape(18.dp),
        elevation = CardDefaults.elevatedCardElevation(defaultElevation = 4.dp)
    ) {
        Row(
            Modifier.fillMaxWidth().padding(horizontal = 18.dp, vertical = 16.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column(Modifier.weight(1f)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(icon, contentDescription = null, tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(18.dp))
                    Spacer(Modifier.width(6.dp))
                    Text(title, fontWeight = FontWeight.SemiBold)
                }
                Text(detail, color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.7f), fontSize = 12.sp, modifier = Modifier.padding(start = 24.dp))
            }
            Spacer(Modifier.width(10.dp))
            Surface(
                shape = CircleShape,
                color = MaterialTheme.colorScheme.primary,
                modifier = Modifier.size(50.dp)
            ) {
                Box(contentAlignment = Alignment.Center) {
                    Text(
                        value,
                        color = MaterialTheme.colorScheme.onPrimary,
                        fontSize = if (value.length > 2) 15.sp else 19.sp,
                        fontWeight = FontWeight.Bold
                    )
                }
            }
        }
    }
}

@Composable
private fun MembersPanel(
    members: List<ClubMember>,
    canInvite: Boolean,
    onInvite: () -> Unit,
    onAcceptMember: suspend (ClubMember) -> Unit,
    onEditMember: suspend (ClubMember, JSONObject) -> Unit,
    onDeleteMember: suspend (ClubMember) -> Unit,
    modifier: Modifier = Modifier
) {
    var memberTab by remember { mutableStateOf("Club Staff") }
    var staffSearch by remember { mutableStateOf("") }
    var playerSearch by remember { mutableStateOf("") }
    var editingMember by remember { mutableStateOf<ClubMember?>(null) }
    var deletingMember by remember { mutableStateOf<ClubMember?>(null) }
    var editSaving by remember { mutableStateOf(false) }
    var deleteSaving by remember { mutableStateOf(false) }
    var acceptingMemberId by remember { mutableStateOf<String?>(null) }
    var memberActionError by remember { mutableStateOf("") }
    var editName by remember(editingMember?.id) { mutableStateOf(editingMember?.name.orEmpty()) }
    var editEmail by remember(editingMember?.id) { mutableStateOf(editingMember?.email.orEmpty()) }
    var editRole by remember(editingMember?.id) { mutableStateOf(editingMember?.role.orEmpty()) }
    var editAgeGroup by remember(editingMember?.id) { mutableStateOf(editingMember?.ageGroup.orEmpty()) }
    var editDisciplines by remember(editingMember?.id) {
        mutableStateOf(
            editingMember?.discipline.orEmpty().split(',').map { it.trim().uppercase() }
                .filter { it in ClubDisciplines }.toSet().ifEmpty { setOf("BATTING") }
        )
    }
    var editLevel by remember(editingMember?.id) { mutableStateOf(editingMember?.currentLevel.orEmpty()) }
    val scope = rememberCoroutineScope()
    val showingPlayers = memberTab == "Players"
    val search = if (showingPlayers) playerSearch else staffSearch
    val visibleMembers = members.filter { member ->
        (member.role == "PLAYER") == showingPlayers &&
            (search.isBlank() || listOf(member.name, member.email, member.squad)
                .any { it.contains(search.trim(), ignoreCase = true) })
    }

    LazyColumn(modifier, verticalArrangement = Arrangement.spacedBy(10.dp)) {
        item {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                Column {
                    Text("Manage club staff and players", fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.7f))
                }
                if (canInvite) WorkspaceAction("Invite", Icons.Outlined.Send, onInvite, primary = true)
            }
        }
        item {
            TabRow(selectedTabIndex = if (showingPlayers) 1 else 0) {
                Tab(
                    selected = !showingPlayers,
                    onClick = { memberTab = "Club Staff" },
                    text = {
                        Row(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
                            Icon(Icons.Filled.Person, contentDescription = null, modifier = Modifier.size(18.dp))
                            Text("Club Staffs", fontSize = 13.sp)
                        }
                    },
                    selectedContentColor = MaterialTheme.colorScheme.primary,
                    unselectedContentColor = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.5f)
                )
                Tab(
                    selected = showingPlayers,
                    onClick = { memberTab = "Players" },
                    text = {
                        Row(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
                            Icon(Icons.Outlined.DirectionsRun, contentDescription = null, modifier = Modifier.size(18.dp))
                            Text("Players", fontSize = 13.sp)
                        }
                    },
                    selectedContentColor = MaterialTheme.colorScheme.primary,
                    unselectedContentColor = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.5f)
                )
            }
        }
        item {
            OutlinedTextField(
                value = search,
                onValueChange = { if (showingPlayers) playerSearch = it else staffSearch = it },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true,
                label = { Text(if (showingPlayers) "Search players" else "Search club staff") },
                leadingIcon = { Icon(Icons.Outlined.Search, contentDescription = null) }
            )
        }
        if (memberActionError.isNotBlank()) {
            item { Text(memberActionError, color = MaterialTheme.colorScheme.error, fontSize = 12.sp) }
        }
        if (visibleMembers.isEmpty()) {
            item {
                EmptyMessage(
                    if (search.isBlank()) "No ${if (showingPlayers) "players" else "club staff"} found for this club."
                    else "No ${if (showingPlayers) "players" else "club staff"} match your search."
                )
            }
        }
        items(visibleMembers, key = ClubMember::id) { member ->
            Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)) {
                Column(Modifier.fillMaxWidth().padding(14.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Column(Modifier.weight(1f)) {
                            Text(member.name, fontWeight = FontWeight.SemiBold)
                            Text("${member.role} · ${member.email}", fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.75f))
                        }
                        if (canInvite) {
                            IconButton(onClick = {
                                memberActionError = ""
                                editingMember = member
                            }) {
                                Icon(Icons.Outlined.Edit, contentDescription = "Edit ${member.name}", tint = MaterialTheme.colorScheme.primary)
                            }
                            IconButton(onClick = {
                                memberActionError = ""
                                deletingMember = member
                            }) {
                                Icon(Icons.Outlined.Delete, contentDescription = "Delete ${member.name}", tint = MaterialTheme.colorScheme.error)
                            }
                        }
                    }
                    Text("${member.ageGroup.ifBlank { "No age group" }} · ${member.discipline} · ${member.currentLevel}", fontSize = 12.sp)
                    Text("Squads: ${member.squads.joinToString(", ").ifBlank { "Unassigned" }}", fontSize = 12.sp)
                    Row(
                        Modifier.fillMaxWidth().padding(top = 6.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Text(
                            if (member.invitationStatus == "ACTIVE") "Active" else "Provisional · awaiting approval",
                            color = if (member.invitationStatus == "ACTIVE") Color(0xFF159B72) else Color(0xFFE28A18),
                            fontSize = 12.sp,
                            fontWeight = FontWeight.SemiBold
                        )
                        if (canInvite && member.invitationStatus == "PENDING_ACCEPTANCE") {
                            Button(
                                onClick = {
                                    scope.launch {
                                        acceptingMemberId = member.id
                                        memberActionError = ""
                                        try {
                                            onAcceptMember(member)
                                        } catch (failure: Exception) {
                                            memberActionError = failure.message ?: "Unable to approve this member."
                                        } finally {
                                            acceptingMemberId = null
                                        }
                                    }
                                },
                                enabled = acceptingMemberId == null
                            ) {
                                Icon(Icons.Outlined.CheckCircle, contentDescription = null, modifier = Modifier.size(17.dp))
                                Spacer(Modifier.width(5.dp))
                                Text(if (acceptingMemberId == member.id) "Approving…" else "Approve")
                            }
                        }
                    }
                }
            }
        }
    }

    editingMember?.let { member ->
        Dialog(
            onDismissRequest = { if (!editSaving) editingMember = null },
            properties = DialogProperties(usePlatformDefaultWidth = false)
        ) {
            BoxWithConstraints(Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
                val dialogMaxHeight = maxHeight * 0.94f
                Surface(
                    modifier = Modifier.fillMaxWidth(0.96f).widthIn(max = 500.dp).heightIn(max = dialogMaxHeight),
                    shape = RoundedCornerShape(16.dp),
                    color = MaterialTheme.colorScheme.surface,
                    shadowElevation = 18.dp
                ) {
                    Column(Modifier.fillMaxWidth().heightIn(max = dialogMaxHeight)) {
                        Column(
                            Modifier.weight(1f, fill = false).verticalScroll(rememberScrollState())
                                .padding(horizontal = 20.dp, vertical = 16.dp),
                            verticalArrangement = Arrangement.spacedBy(12.dp)
                        ) {
                            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                                Row(Modifier.weight(1f), verticalAlignment = Alignment.CenterVertically) {
                                    Icon(Icons.Outlined.Edit, contentDescription = null, tint = MaterialTheme.colorScheme.primary)
                                    Spacer(Modifier.width(8.dp))
                                    Text(
                                        "Edit ${if (member.role == "PLAYER") "Player" else "Coach"} Details",
                                        fontWeight = FontWeight.Bold,
                                        fontSize = 18.sp
                                    )
                                }
                                IconButton(onClick = { editingMember = null }, enabled = !editSaving) {
                                    Icon(Icons.Outlined.Close, contentDescription = "Close editor")
                                }
                            }
                            Text(
                                "Update roster details for ${member.name}.",
                                fontSize = 12.sp,
                                color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.7f)
                            )
                            HorizontalDivider(color = MaterialTheme.colorScheme.outline.copy(alpha = 0.3f))

                            Column(verticalArrangement = Arrangement.spacedBy(5.dp)) {
                                Text("Full Name *", fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
                                OutlinedTextField(editName, { editName = it }, modifier = Modifier.fillMaxWidth(), singleLine = true, shape = RoundedCornerShape(8.dp))
                            }
                            Column(verticalArrangement = Arrangement.spacedBy(5.dp)) {
                                Text("Email Address *", fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
                                OutlinedTextField(editEmail, { editEmail = it }, modifier = Modifier.fillMaxWidth(), singleLine = true, shape = RoundedCornerShape(8.dp))
                            }
                            if (editRole == "PLAYER") {
                                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                                    MemberEditSelect(
                                        label = "Role",
                                        value = editRole,
                                        options = listOf("PLAYER" to "Player", "COACH" to "Coach"),
                                        modifier = Modifier.weight(1f),
                                        onSelect = { role ->
                                            editRole = role
                                            val levels = if (role == "PLAYER") setOf("FOUNDATION", "DEVELOPING", "INTERMEDIATE", "ADVANCED", "ELITE")
                                                else setOf("SUPPORT_COACH", "FOUNDATION_COACH", "CORE_COACH", "ADVANCED_COACH", "SPECIALIST_COACH")
                                            if (editLevel !in levels) editLevel = if (role == "PLAYER") "FOUNDATION" else "SUPPORT_COACH"
                                        }
                                    )
                                    MemberEditSelect(
                                        label = "Age Group",
                                        value = editAgeGroup,
                                        options = listOf(
                                            "U9" to "Under-9", "U11" to "Under-11", "U13" to "Under-13",
                                            "U15" to "Under-15", "U19" to "Under-19", "Senior" to "Senior"
                                        ),
                                        modifier = Modifier.weight(1f),
                                        onSelect = { editAgeGroup = it }
                                    )
                                }
                            } else {
                                Row(Modifier.fillMaxWidth()) {
                                    MemberEditSelect(
                                        label = "Role",
                                        value = editRole,
                                        options = listOf("PLAYER" to "Player", "COACH" to "Coach"),
                                        modifier = Modifier.weight(1f),
                                        onSelect = { role ->
                                            editRole = role
                                            val levels = if (role == "PLAYER") setOf("FOUNDATION", "DEVELOPING", "INTERMEDIATE", "ADVANCED", "ELITE")
                                                else setOf("SUPPORT_COACH", "FOUNDATION_COACH", "CORE_COACH", "ADVANCED_COACH", "SPECIALIST_COACH")
                                            if (editLevel !in levels) editLevel = if (role == "PLAYER") "FOUNDATION" else "SUPPORT_COACH"
                                        }
                                    )
                                    Spacer(Modifier.weight(1f))
                                }
                            }
                            Column(verticalArrangement = Arrangement.spacedBy(7.dp)) {
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Text("Disciplines *", fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
                                    Spacer(Modifier.width(5.dp))
                                    Text("(Select one or multiple)", fontSize = 10.sp, color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f))
                                }
                                Row(
                                    Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()),
                                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                                ) {
                                    listOf(
                                        "BATTING" to ("🏏" to "Batting"),
                                        "BOWLING" to ("⚡" to "Bowling"),
                                        "KEEPING" to ("🧤" to "Keeping"),
                                        "FIELDING" to ("🎯" to "Fielding")
                                    ).forEach { (discipline, content) ->
                                        val checked = discipline in editDisciplines
                                        Surface(
                                            onClick = {
                                                if (checked && editDisciplines.size == 1) return@Surface
                                                editDisciplines = if (checked) editDisciplines - discipline else editDisciplines + discipline
                                            },
                                            modifier = Modifier.width(90.dp).height(68.dp),
                                            color = if (checked) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.surfaceVariant,
                                            shape = RoundedCornerShape(10.dp)
                                        ) {
                                            Row(
                                                Modifier.fillMaxSize().padding(horizontal = 4.dp),
                                                horizontalArrangement = Arrangement.Center,
                                                verticalAlignment = Alignment.CenterVertically
                                            ) {
                                                Checkbox(
                                                    checked = checked,
                                                    enabled = checked || editDisciplines.size > 1,
                                                    onCheckedChange = { selected ->
                                                        editDisciplines = if (selected) editDisciplines + discipline else editDisciplines - discipline
                                                    },
                                                    colors = CheckboxDefaults.colors(
                                                        checkedColor = MaterialTheme.colorScheme.onPrimary,
                                                        checkmarkColor = MaterialTheme.colorScheme.primary,
                                                        uncheckedColor = if (checked) MaterialTheme.colorScheme.onPrimary else MaterialTheme.colorScheme.outline
                                                    )
                                                )
                                                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                                    Text(content.first, fontSize = 13.sp)
                                                    Text(
                                                        content.second,
                                                        fontSize = 10.sp,
                                                        fontWeight = FontWeight.SemiBold,
                                                        color = if (checked) MaterialTheme.colorScheme.onPrimary else MaterialTheme.colorScheme.onSurface
                                                    )
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                            MemberEditSelect(
                                label = "Current Level",
                                value = editLevel,
                                options = if (editRole == "PLAYER") listOf(
                                    "FOUNDATION" to "Foundation", "DEVELOPING" to "Developing", "INTERMEDIATE" to "Intermediate",
                                    "ADVANCED" to "Advanced", "ELITE" to "Elite"
                                ) else listOf(
                                    "SUPPORT_COACH" to "Support Coach", "FOUNDATION_COACH" to "Foundation Coach",
                                    "CORE_COACH" to "Core Coach", "ADVANCED_COACH" to "Advanced Coach", "SPECIALIST_COACH" to "Specialist Coach"
                                ),
                                onSelect = { editLevel = it }
                            )
                            if (memberActionError.isNotBlank()) {
                                Text(memberActionError, color = MaterialTheme.colorScheme.error, fontSize = 12.sp)
                            }
                        }
                        HorizontalDivider(color = MaterialTheme.colorScheme.outline.copy(alpha = 0.3f))
                        Row(
                            Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 12.dp),
                            horizontalArrangement = Arrangement.End,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            TextButton(onClick = { editingMember = null }, enabled = !editSaving) { Text("Cancel") }
                            Spacer(Modifier.width(8.dp))
                            Button(
                                enabled = !editSaving && editName.isNotBlank() && editEmail.isNotBlank() &&
                                    editRole in setOf("COACH", "PLAYER") && editDisciplines.isNotEmpty(),
                                onClick = {
                                    scope.launch {
                                        editSaving = true
                                        memberActionError = ""
                                        try {
                                            onEditMember(member, JSONObject()
                                                .put("name", editName.trim())
                                                .put("email", editEmail.trim())
                                                .put("role", editRole)
                                                .put("ageGroup", if (editRole == "PLAYER") editAgeGroup.trim() else "")
                                                .put("discipline", ClubDisciplines.filter(editDisciplines::contains).joinToString(", "))
                                                .put("currentLevel", editLevel.trim()))
                                            editingMember = null
                                        } catch (failure: Exception) {
                                            memberActionError = failure.message ?: "Unable to update this member."
                                        } finally {
                                            editSaving = false
                                        }
                                    }
                                }
                            ) { Text(if (editSaving) "Saving…" else "Save Changes") }
                        }
                    }
                }
            }
        }
    }

    deletingMember?.let { member ->
        AlertDialog(
            onDismissRequest = { if (!deleteSaving) deletingMember = null },
            title = { Text("Delete member?") },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text("Remove ${member.name} from this club? This removes the club membership and cannot be undone.")
                    if (memberActionError.isNotBlank()) {
                        Text(memberActionError, color = MaterialTheme.colorScheme.error, fontSize = 12.sp)
                    }
                }
            },
            confirmButton = {
                Button(
                    enabled = !deleteSaving,
                    onClick = {
                        scope.launch {
                            deleteSaving = true
                            memberActionError = ""
                            try {
                                onDeleteMember(member)
                                deletingMember = null
                            } catch (failure: Exception) {
                                memberActionError = failure.message ?: "Unable to delete this member."
                            } finally {
                                deleteSaving = false
                            }
                        }
                    }
                ) { Text(if (deleteSaving) "Deleting…" else "Delete") }
            },
            dismissButton = { TextButton(onClick = { deletingMember = null }, enabled = !deleteSaving) { Text("Cancel") } }
        )
    }
}

@Composable
private fun MemberEditSelect(
    label: String,
    value: String,
    options: List<Pair<String, String>>,
    modifier: Modifier = Modifier,
    onSelect: (String) -> Unit
) {
    var expanded by remember { mutableStateOf(false) }
    val selectedLabel = options.firstOrNull { it.first == value }?.second ?: value
    Column(modifier, verticalArrangement = Arrangement.spacedBy(5.dp)) {
        Text(label, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
        Box {
            Surface(
                onClick = { expanded = true },
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(8.dp),
                color = MaterialTheme.colorScheme.surface,
                contentColor = MaterialTheme.colorScheme.onSurface,
                border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.7f))
            ) {
                Row(
                    Modifier.fillMaxWidth().height(48.dp).padding(horizontal = 12.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(selectedLabel, fontSize = 13.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
                    Icon(Icons.Outlined.ExpandMore, contentDescription = "Choose $label")
                }
            }
            DropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }) {
                options.forEach { (optionValue, optionLabel) ->
                    DropdownMenuItem(
                        text = { Text(optionLabel) },
                        onClick = {
                            expanded = false
                            onSelect(optionValue)
                        }
                    )
                }
            }
        }
    }
}

@Composable
private fun SquadPanel(
    squads: List<ClubSquad>,
    members: List<ClubMember>,
    onCreate: () -> Unit,
    onEdit: (ClubSquad) -> Unit,
    onDelete: (ClubSquad) -> Unit,
    modifier: Modifier = Modifier
) {
    var deleteTarget by remember { mutableStateOf<ClubSquad?>(null) }
    var search by remember { mutableStateOf("") }
    var sortOption by remember { mutableStateOf("Age (U15 → U18)") }
    var sortMenuOpen by remember { mutableStateOf(false) }
    val sortOptions = listOf("Age (U15 → U18)", "Age (U18 → U15)", "Name (A → Z)", "Name (Z → A)")
    val searchText = search.trim()
    val filteredSquads = squads.filter { squad ->
        searchText.isBlank() || squad.name.contains(searchText, ignoreCase = true) ||
            squad.ageGroup.contains(searchText, ignoreCase = true) || squad.disciplines.any { it.contains(searchText, ignoreCase = true) }
    }
    fun ageRank(squad: ClubSquad) = Regex("\\d+").find(squad.ageGroup)?.value?.toIntOrNull() ?: Int.MAX_VALUE
    val sortedSquads = when (sortOption) {
        "Age (U18 → U15)" -> filteredSquads.sortedWith(compareByDescending<ClubSquad> { ageRank(it) }.thenBy { it.name })
        "Name (A → Z)" -> filteredSquads.sortedBy { it.name.lowercase() }
        "Name (Z → A)" -> filteredSquads.sortedByDescending { it.name.lowercase() }
        else -> filteredSquads.sortedWith(compareBy<ClubSquad> { ageRank(it) }.thenBy { it.name })
    }
    BoxWithConstraints(modifier) {
        val isWide = maxWidth >= 900.dp
        LazyColumn(Modifier.fillMaxSize(), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            item {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    if (isWide) {
                        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(9.dp), verticalAlignment = Alignment.CenterVertically) {
                            SquadSearchField(search, { search = it }, Modifier.width(190.dp))
                            SquadSortMenu(sortOption, sortOptions, sortMenuOpen, { sortMenuOpen = it }, { sortOption = it })
                            Button(onClick = onCreate, shape = RoundedCornerShape(14.dp)) {
                                Icon(Icons.Outlined.Add, contentDescription = null, modifier = Modifier.size(20.dp))
                                Text("  New squad", fontWeight = FontWeight.Bold, fontSize = 13.sp)
                                Icon(Icons.Outlined.Groups, contentDescription = null, modifier = Modifier.padding(start = 4.dp).size(18.dp))
                            }
                        }
                    } else {
                        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End, verticalAlignment = Alignment.CenterVertically) {
                            Button(onClick = onCreate, shape = RoundedCornerShape(14.dp)) {
                                Icon(Icons.Outlined.Add, contentDescription = null, modifier = Modifier.size(19.dp))
                                Text(" New squad", fontWeight = FontWeight.Bold, fontSize = 12.sp)
                            }
                        }
                        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                            SquadSearchField(search, { search = it }, Modifier.weight(1f))
                            SquadSortMenu(sortOption, sortOptions, sortMenuOpen, { sortMenuOpen = it }, { sortOption = it })
                        }
                    }
                }
            }
            if (squads.isEmpty()) {
                item { EmptyMessage("Create a squad to organize your players.") }
            } else if (sortedSquads.isEmpty()) {
                item { EmptyMessage("No squads match your search.") }
            } else if (isWide) {
                items(sortedSquads.chunked(2)) { pair ->
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        pair.forEach { squad ->
                            SquadCard(squad, members.count { it.isInSquad(squad.name) }, Modifier.weight(1f), onEdit = { onEdit(squad) }, onDelete = { deleteTarget = squad })
                        }
                        if (pair.size == 1) Spacer(Modifier.weight(1f))
                    }
                }
            } else {
                items(sortedSquads, key = ClubSquad::id) { squad ->
                    SquadCard(squad, members.count { it.isInSquad(squad.name) }, Modifier.fillMaxWidth(), onEdit = { onEdit(squad) }, onDelete = { deleteTarget = squad })
                }
            }
        }
    }
    deleteTarget?.let { squad ->
        AlertDialog(
            onDismissRequest = { deleteTarget = null },
            title = { Text("Delete squad?") },
            text = { Text("Permanently delete '${squad.name}'? Members will become unassigned. This cannot be undone.") },
            confirmButton = {
                Button(onClick = {
                    deleteTarget = null
                    onDelete(squad)
                }) { Text("Delete squad") }
            },
            dismissButton = { TextButton(onClick = { deleteTarget = null }) { Text("Keep squad") } }
        )
    }
}

@Composable
private fun SquadSearchField(value: String, onValueChange: (String) -> Unit, modifier: Modifier = Modifier) {
    OutlinedTextField(
        value = value,
        onValueChange = onValueChange,
        modifier = modifier,
        singleLine = true,
        placeholder = { Text("Search squads…", fontSize = 13.sp) },
        leadingIcon = { Icon(Icons.Outlined.Search, contentDescription = null, modifier = Modifier.size(19.dp)) },
        shape = RoundedCornerShape(16.dp),
        colors = androidx.compose.material3.OutlinedTextFieldDefaults.colors(
            unfocusedContainerColor = MaterialTheme.colorScheme.surface,
            focusedContainerColor = MaterialTheme.colorScheme.surface
        )
    )
}

@Composable
private fun SquadSortMenu(
    selected: String,
    options: List<String>,
    expanded: Boolean,
    onExpandedChange: (Boolean) -> Unit,
    onSelect: (String) -> Unit
) {
    Box {
        OutlinedButton(
            onClick = { onExpandedChange(true) },
            shape = RoundedCornerShape(16.dp),
            modifier = Modifier.widthIn(min = 164.dp, max = 210.dp)
        ) {
            Text("Sort: ${selected.substringAfter(": ")}", fontSize = 12.sp, maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.weight(1f))
            Icon(Icons.Outlined.ExpandMore, contentDescription = "Sort squads", modifier = Modifier.size(19.dp))
        }
        DropdownMenu(expanded = expanded, onDismissRequest = { onExpandedChange(false) }) {
            options.forEach { option ->
                DropdownMenuItem(
                    text = { Text(option, fontSize = 13.sp) },
                    onClick = {
                        onSelect(option)
                        onExpandedChange(false)
                    }
                )
            }
        }
    }
}

@Composable
private fun EkotaFilterChip(label: String, selected: Boolean, accent: Color, onClick: () -> Unit) {
    Surface(
        onClick = onClick,
        shape = RoundedCornerShape(22.dp),
        color = if (selected) accent else Color.White.copy(alpha = 0.72f),
        border = BorderStroke(1.dp, if (selected) accent else accent.copy(alpha = 0.12f))
    ) {
        Row(Modifier.padding(horizontal = 13.dp, vertical = 8.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(7.dp)) {
            Box(Modifier.size(9.dp).background(if (selected) Color.White else accent, CircleShape))
            Text(label, color = if (selected) Color.White else EkotaOverviewColors.onSurfaceVariant, fontSize = 12.sp, fontWeight = FontWeight.SemiBold, maxLines = 1)
        }
    }
}

@Composable
private fun SquadCard(squad: ClubSquad, memberCount: Int, modifier: Modifier = Modifier, onEdit: () -> Unit, onDelete: () -> Unit) {
    val scheme = MaterialTheme.colorScheme
    val accents = listOf(Color(0xFF7448EF), Color(0xFF248AF2), Color(0xFF12A875), Color(0xFFF1842D))
    val accent = accents[Math.floorMod(squad.id.hashCode(), accents.size)]
    Card(
        modifier = modifier,
        colors = CardDefaults.cardColors(containerColor = scheme.surface),
        shape = RoundedCornerShape(20.dp),
        border = BorderStroke(1.dp, scheme.outlineVariant.copy(alpha = 0.8f)),
        elevation = CardDefaults.cardElevation(defaultElevation = 3.dp)
    ) {
        Column(Modifier.fillMaxWidth().padding(16.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Surface(shape = RoundedCornerShape(14.dp), color = accent, modifier = Modifier.size(58.dp)) {
                    Box(contentAlignment = Alignment.Center) {
                        Icon(Icons.Outlined.Groups, contentDescription = null, tint = Color.White, modifier = Modifier.size(30.dp))
                    }
                }
                Spacer(Modifier.width(12.dp))
                Column(Modifier.weight(1f)) {
                    Text(squad.name, color = scheme.onSurface, fontWeight = FontWeight.ExtraBold, fontSize = 18.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
                    Text(
                        "${squad.ageGroup.ifBlank { "All ages" }} · $memberCount ${if (memberCount == 1) "member" else "members"}",
                        fontSize = 13.sp,
                        color = scheme.onSurface.copy(alpha = 0.65f)
                    )
                }
                Box(Modifier.size(38.dp).background(accent.copy(alpha = 0.1f), CircleShape), contentAlignment = Alignment.Center) {
                    Icon(Icons.AutoMirrored.Outlined.KeyboardArrowRight, contentDescription = null, tint = accent, modifier = Modifier.size(25.dp))
                }
            }
            if (squad.disciplines.isNotEmpty()) {
                Row(
                    Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()).padding(top = 14.dp, bottom = 8.dp),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    squad.disciplines.forEach { discipline -> DisciplineChip(discipline) }
                }
            }
            HorizontalDivider(color = scheme.outline.copy(alpha = 0.35f), modifier = Modifier.padding(vertical = 8.dp))
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp, Alignment.End)) {
                SquadCardAction("Edit", Icons.Outlined.Edit, Color(0xFF2679F4), onEdit)
                SquadCardAction("Delete", Icons.Outlined.Delete, Color(0xFFED4D5A), onDelete)
            }
        }
    }
}

@Composable
private fun SquadCardAction(
    label: String,
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    accent: Color,
    onClick: () -> Unit
) {
    Surface(
        onClick = onClick,
        shape = RoundedCornerShape(18.dp),
        color = accent.copy(alpha = 0.09f)
    ) {
        Row(Modifier.padding(horizontal = 16.dp, vertical = 9.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(7.dp)) {
            Icon(icon, contentDescription = null, tint = accent, modifier = Modifier.size(19.dp))
            Text(label, color = accent, fontSize = 13.sp, fontWeight = FontWeight.Bold)
        }
    }
}

@Composable
private fun EditSquadPanel(
    squad: ClubSquad,
    members: List<ClubMember>,
    isSaving: Boolean,
    saveError: String,
    onSave: (String, String, List<String>) -> Unit,
    onDelete: () -> Unit,
    onToggleMember: (ClubMember, Boolean) -> Unit,
    onBack: () -> Unit,
    modifier: Modifier = Modifier
) {
    var name by remember(squad.id) { mutableStateOf(squad.name) }
    var ageGroup by remember(squad.id) { mutableStateOf(squad.ageGroup) }
    val selected = remember(squad.id) {
        mutableStateMapOf<String, Boolean>().apply { ClubDisciplines.forEach { put(it, it in squad.disciplines) } }
    }
    var deleteConfirm by remember { mutableStateOf(false) }
    var playerSearch by remember { mutableStateOf("") }
    var showPlayerPicker by remember { mutableStateOf(false) }
    val playerCount = members.count { it.role == "PLAYER" && it.isInSquad(squad.name) }

    BoxWithConstraints(modifier) {
        val isTablet = maxWidth >= 600.dp
        Column(Modifier.fillMaxSize()) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                IconButton(onClick = onBack) { Icon(Icons.AutoMirrored.Outlined.ArrowBack, contentDescription = "Back") }
                Text("Edit squad", color = MaterialTheme.colorScheme.primary, fontSize = 20.sp, fontWeight = FontWeight.Bold)
            }
            Spacer(Modifier.height(10.dp))
            if (isTablet) {
                Row(Modifier.fillMaxSize(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    SquadDetailsCard(
                        name = name,
                        onNameChange = { name = it },
                        ageGroup = ageGroup,
                        onAgeGroupChange = { ageGroup = it },
                        selected = selected,
                        isSaving = isSaving,
                        saveError = saveError,
                        onSave = { onSave(name.trim(), ageGroup.trim(), selected.filterValues { it }.keys.toList()) },
                        onDeleteRequest = { deleteConfirm = true },
                        modifier = Modifier.weight(1f).fillMaxHeight().verticalScroll(rememberScrollState())
                    )
                    SquadPlayersPanel(
                        squad = squad,
                        members = members,
                        search = playerSearch,
                        onSearchChange = { playerSearch = it },
                        onToggle = onToggleMember,
                        modifier = Modifier.weight(1f).fillMaxHeight()
                    )
                }
            } else {
                Column(Modifier.fillMaxWidth().verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    SquadDetailsCard(
                        name = name,
                        onNameChange = { name = it },
                        ageGroup = ageGroup,
                        onAgeGroupChange = { ageGroup = it },
                        selected = selected,
                        isSaving = isSaving,
                        saveError = saveError,
                        onSave = { onSave(name.trim(), ageGroup.trim(), selected.filterValues { it }.keys.toList()) },
                        onDeleteRequest = { deleteConfirm = true },
                        modifier = Modifier.fillMaxWidth()
                    )
                    WorkspaceAction("Manage players ($playerCount)", Icons.Outlined.Group, { showPlayerPicker = true })
                }
            }
        }
    }
    if (showPlayerPicker) {
        AlertDialog(
            onDismissRequest = { showPlayerPicker = false },
            title = { Text("Manage players") },
            text = {
                SquadPlayersPanel(
                    squad = squad,
                    members = members,
                    search = playerSearch,
                    onSearchChange = { playerSearch = it },
                    onToggle = onToggleMember,
                    modifier = Modifier.height(380.dp)
                )
            },
            confirmButton = { TextButton(onClick = { showPlayerPicker = false }) { Text("Done") } }
        )
    }
    if (deleteConfirm) {
        AlertDialog(
            onDismissRequest = { deleteConfirm = false },
            title = { Text("Delete squad?") },
            text = { Text("Permanently delete '${squad.name}'? Members will become unassigned. This cannot be undone.") },
            confirmButton = {
                Button(onClick = { deleteConfirm = false; onDelete() }) { Text("Delete squad") }
            },
            dismissButton = { TextButton(onClick = { deleteConfirm = false }) { Text("Keep squad") } }
        )
    }
}

@Composable
private fun SquadDetailsCard(
    name: String,
    onNameChange: (String) -> Unit,
    ageGroup: String,
    onAgeGroupChange: (String) -> Unit,
    selected: SnapshotStateMap<String, Boolean>,
    isSaving: Boolean,
    saveError: String,
    onSave: () -> Unit,
    onDeleteRequest: () -> Unit,
    modifier: Modifier = Modifier
) {
    Card(modifier = modifier, colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)) {
        Column(Modifier.fillMaxWidth().padding(14.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            WorkspaceField(name, onNameChange, "Squad name", Modifier.fillMaxWidth(), enabled = !isSaving)
            WorkspaceField(ageGroup, onAgeGroupChange, "Age group", Modifier.fillMaxWidth(), enabled = !isSaving)
            Text("Disciplines", fontWeight = FontWeight.SemiBold)
            ClubDisciplines.forEach { discipline ->
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Checkbox(checked = selected[discipline] == true, onCheckedChange = { selected[discipline] = it }, enabled = !isSaving)
                    Icon(disciplineIcon(discipline), contentDescription = null, tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(16.dp))
                    Spacer(Modifier.width(6.dp))
                    Text(discipline)
                }
            }
            if (saveError.isNotBlank()) Text(saveError, color = MaterialTheme.colorScheme.error, fontSize = 12.sp)
            HorizontalDivider(color = MaterialTheme.colorScheme.primary.copy(alpha = 0.3f), modifier = Modifier.padding(top = 4.dp, bottom = 4.dp))
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(2.dp, Alignment.End)) {
                WorkspaceAction("Delete", Icons.Outlined.Delete, onDeleteRequest, enabled = !isSaving)
                WorkspaceAction(
                    "Save",
                    Icons.Outlined.CheckCircle,
                    onSave,
                    enabled = !isSaving && name.isNotBlank() && selected.values.any { it },
                    primary = true
                )
            }
        }
    }
}

@Composable
private fun SquadPlayersPanel(
    squad: ClubSquad,
    members: List<ClubMember>,
    search: String,
    onSearchChange: (String) -> Unit,
    onToggle: (ClubMember, Boolean) -> Unit,
    modifier: Modifier = Modifier
) {
    val players = members
        .filter { it.role == "PLAYER" }
        .filter { it.name.contains(search.trim(), ignoreCase = true) }
        .sortedByDescending { it.isInSquad(squad.name) }
    Card(modifier = modifier, colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)) {
        Column(Modifier.fillMaxSize().padding(14.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Text("Players", fontWeight = FontWeight.SemiBold)
            WorkspaceField(search, onSearchChange, "Filter players", Modifier.fillMaxWidth())
            if (players.isEmpty()) {
                EmptyMessage("No players match this filter.")
            } else {
                Column(Modifier.weight(1f, fill = false).verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    players.forEach { member ->
                        val inSquad = member.isInSquad(squad.name)
                        Row(
                            Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Column(Modifier.weight(1f)) {
                                Text(member.name, fontSize = 13.sp, fontWeight = FontWeight.Medium)
                                Text(
                                    if (inSquad) "In this squad" else member.squads.joinToString(", ").ifBlank { "Unassigned" },
                                    fontSize = 11.sp,
                                    color = if (inSquad) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f)
                                )
                            }
                            Surface(
                                shape = CircleShape,
                                color = if (inSquad) MaterialTheme.colorScheme.error.copy(alpha = 0.15f) else MaterialTheme.colorScheme.primary.copy(alpha = 0.15f),
                                modifier = Modifier.size(32.dp)
                            ) {
                                IconButton(onClick = { onToggle(member, !inSquad) }, modifier = Modifier.size(32.dp)) {
                                    Icon(
                                        if (inSquad) Icons.Outlined.Remove else Icons.Outlined.Add,
                                        contentDescription = if (inSquad) "Remove from squad" else "Add to squad",
                                        tint = if (inSquad) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.primary,
                                        modifier = Modifier.size(18.dp)
                                    )
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun SessionsPanel(
    sessions: List<ClubTrainingSession>,
    userId: String,
    canDeleteAny: Boolean,
    canSchedule: Boolean,
    canCoachSessions: Boolean,
    allDrills: List<Drill> = emptyList(),
    onSchedule: () -> Unit,
    onEdit: (ClubTrainingSession) -> Unit,
    onDelete: (ClubTrainingSession) -> Unit,
    onPublish: (ClubTrainingSession) -> Unit,
    onExecute: (ClubTrainingSession) -> Unit,
    onReview: (ClubTrainingSession) -> Unit,
    modifier: Modifier = Modifier
) {
    var search by remember { mutableStateOf("") }
    var fromDate by remember { mutableStateOf("") }
    var throughDate by remember { mutableStateOf("") }
    var status by remember { mutableStateOf("ALL") }
    var deleteTarget by remember { mutableStateOf<ClubTrainingSession?>(null) }
    val validRange = (fromDate.isBlank() || isIsoDate(fromDate)) &&
        (throughDate.isBlank() || isIsoDate(throughDate)) &&
        (fromDate.isBlank() || throughDate.isBlank() || fromDate <= throughDate)
    val filteredSessions = sessions.filter { session ->
        val executionStatus = session.executionLog?.optString("status").orEmpty()
        val matchesStatus = when (status) {
            "UPCOMING" -> !session.isExecuted &&
                executionStatus !in setOf("IN_PROGRESS", "PAUSED") &&
                session.sessionDate >= LocalDate.now().toString()
            "IN_PROGRESS" -> executionStatus == "IN_PROGRESS" || executionStatus == "PREPARING"
            "PAUSED" -> executionStatus == "PAUSED"
            "COMPLETED" -> session.isExecuted
            "CANCELLED" -> executionStatus == "CANCELLED"
            else -> true
        }
        session.title.contains(search.trim(), ignoreCase = true) &&
            (fromDate.isBlank() || session.sessionDate >= fromDate) &&
            (throughDate.isBlank() || session.sessionDate <= throughDate) &&
            matchesStatus
    }
    BoxWithConstraints(modifier) {
        val isTablet = maxWidth >= 600.dp
        val sortedSessions = filteredSessions.sortedByDescending(ClubTrainingSession::sessionDate)
        LazyColumn(Modifier.fillMaxSize(), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            item {
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End, verticalAlignment = Alignment.CenterVertically) {
                    if (canSchedule) Button(onClick = onSchedule, shape = RoundedCornerShape(14.dp)) {
                        Icon(Icons.Outlined.Add, contentDescription = null, modifier = Modifier.size(20.dp))
                        Text("  Schedule session", fontWeight = FontWeight.Bold, fontSize = 13.sp)
                        Icon(Icons.Outlined.CalendarMonth, contentDescription = null, modifier = Modifier.padding(start = 4.dp).size(18.dp))
                    }
                }
                if (isTablet) {
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                        WorkspaceField(search, { search = it }, "Search sessions…", Modifier.weight(1.4f))
                        DateField(fromDate, { fromDate = it }, "From date", Modifier.weight(1f))
                        DateField(throughDate, { throughDate = it }, "To date", Modifier.weight(1f))
                    }
                } else {
                    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        WorkspaceField(search, { search = it }, "Search sessions…", Modifier.fillMaxWidth())
                        Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                            DateField(fromDate, { fromDate = it }, "From date", Modifier.weight(1f))
                            DateField(throughDate, { throughDate = it }, "To date", Modifier.weight(1f))
                        }
                    }
                }
                Row(Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    listOf(
                        "ALL" to ("All" to Color(0xFF7448EF)),
                        "UPCOMING" to ("Upcoming" to Color(0xFF7448EF)),
                        "IN_PROGRESS" to ("In progress" to Color(0xFF18B982)),
                        "PAUSED" to ("Paused" to Color(0xFFB7791F)),
                        "COMPLETED" to ("Completed" to Color(0xFF3D6FE8)),
                        "CANCELLED" to ("Cancelled" to Color(0xFFEF6672))
                    ).forEach { (value, chip) ->
                        EkotaFilterChip(chip.first, status == value, chip.second) {
                            status = value
                        }
                    }
                }
                if (!validRange) Text("Enter valid dates and make sure the start date is not after the end date.", color = MaterialTheme.colorScheme.error)
            }
            if (sortedSessions.isEmpty()) {
                item { EmptyMessage(if (sessions.isEmpty()) "No training sessions scheduled yet." else "No sessions match these filters.") }
            } else if (isTablet) {
                items(sortedSessions.chunked(2)) { pair ->
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        pair.forEach { session ->
                            SessionCard(
                                session = session,
                                userId = userId,
                                canDeleteAny = canDeleteAny,
                                canCoachSessions = canCoachSessions,
                                allDrills = allDrills,
                                onEdit = onEdit,
                                onDelete = { deleteTarget = session },
                                onPublish = onPublish,
                                onExecute = onExecute,
                                onReview = onReview,
                                modifier = Modifier.weight(1f)
                            ) }
                        if (pair.size == 1) Spacer(Modifier.weight(1f))
                    }
                }
            } else {
                items(sortedSessions, key = ClubTrainingSession::id) { session ->
                    SessionCard(
                        session = session,
                        userId = userId,
                        canDeleteAny = canDeleteAny,
                        canCoachSessions = canCoachSessions,
                        allDrills = allDrills,
                        onEdit = onEdit,
                        onDelete = { deleteTarget = session },
                        onPublish = onPublish,
                        onExecute = onExecute,
                        onReview = onReview,
                        modifier = Modifier.fillMaxWidth()
                    )
                }
            }
        }
    }
    deleteTarget?.let { session ->
        AlertDialog(
            onDismissRequest = { deleteTarget = null },
            title = { Text("Delete scheduled session?") },
            text = { Text("Permanently delete '${session.title}'? This cannot be undone.") },
            confirmButton = {
                Button(onClick = {
                    deleteTarget = null
                    onDelete(session)
                }) { Text("Delete session") }
            },
            dismissButton = { TextButton(onClick = { deleteTarget = null }) { Text("Keep session") } }
        )
    }
}

@Composable
private fun SessionIconAction(
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    label: String,
    onClick: () -> Unit,
    danger: Boolean = false
) {
    val color = if (danger) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.primary
    Surface(shape = RoundedCornerShape(8.dp), color = color.copy(alpha = 0.12f)) {
        IconButton(onClick = onClick, modifier = Modifier.size(32.dp)) {
            Icon(icon, contentDescription = label, tint = color, modifier = Modifier.size(16.dp))
        }
    }
}

@Composable
private fun SessionCard(
    session: ClubTrainingSession,
    userId: String,
    canDeleteAny: Boolean,
    canCoachSessions: Boolean,
    allDrills: List<Drill> = emptyList(),
    onEdit: (ClubTrainingSession) -> Unit,
    onDelete: () -> Unit,
    onPublish: (ClubTrainingSession) -> Unit,
    onExecute: (ClubTrainingSession) -> Unit,
    onReview: (ClubTrainingSession) -> Unit,
    modifier: Modifier = Modifier
) {
    var safetyExpanded by remember(session.id) { mutableStateOf(false) }
    val statusColor = sessionStatusColor(session)
    val thumbnailDrill = allDrills.firstOrNull { drill -> drill.id in session.drillIds && !drill.imageUrl.isNullOrBlank() }
    val plannedDrillIds = session.drillIds.distinct()
    val plannedDrillTitles = plannedDrillIds.map { drillId ->
        allDrills.firstOrNull { it.id == drillId }?.title ?: "Unknown Drill"
    }
    Card(
        modifier = modifier,
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        shape = RoundedCornerShape(18.dp),
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.8f)),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Column(Modifier.fillMaxWidth().padding(10.dp)) {
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.Top, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                Box(Modifier.size(width = 86.dp, height = 94.dp).clip(RoundedCornerShape(9.dp))) {
                    val imageUrl = thumbnailDrill?.imageUrl
                    if (!imageUrl.isNullOrBlank()) {
                        AsyncImage(
                            model = overviewDrillImageSource(imageUrl),
                            contentDescription = thumbnailDrill.title,
                            contentScale = androidx.compose.ui.layout.ContentScale.Crop,
                            modifier = Modifier.fillMaxSize()
                        )
                    } else {
                        Box(Modifier.fillMaxSize().background(Brush.verticalGradient(listOf(Color(0xFF18223B), Color(0xFF435171)))), contentAlignment = Alignment.Center) {
                            Icon(Icons.Outlined.SportsCricket, contentDescription = null, tint = Color.White, modifier = Modifier.size(39.dp))
                        }
                    }
                }
                Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(session.title, color = MaterialTheme.colorScheme.onSurface, fontSize = 16.sp, fontWeight = FontWeight.ExtraBold, maxLines = 2, overflow = TextOverflow.Ellipsis, modifier = Modifier.weight(1f))
                        Surface(shape = RoundedCornerShape(50), color = statusColor.copy(alpha = 0.13f)) {
                            Text(
                                sessionStatusLabel(session),
                                color = statusColor,
                                fontSize = 11.sp,
                                fontWeight = FontWeight.Bold,
                                modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
                            )
                        }
                    }
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(5.dp)) {
                        Icon(Icons.Outlined.Groups, contentDescription = null, tint = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.size(17.dp))
                        Text(session.squadName, fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant, maxLines = 1, overflow = TextOverflow.Ellipsis)
                        Icon(Icons.Outlined.AccessTime, contentDescription = null, tint = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.padding(start = 5.dp).size(17.dp))
                        Text("${session.durationMinutes} min", fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Filled.Person, contentDescription = null, tint = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.size(16.dp))
                        Text(" Led by ${session.coachName ?: session.coachId ?: "Coach"}", fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant, maxLines = 1, overflow = TextOverflow.Ellipsis)
                    }
                    Surface(color = Color(0xFFE8EEFF), shape = RoundedCornerShape(7.dp), modifier = Modifier.padding(top = 2.dp)) {
                        Row(Modifier.padding(horizontal = 7.dp, vertical = 4.dp), verticalAlignment = Alignment.CenterVertically) {
                            Icon(Icons.Outlined.CalendarMonth, contentDescription = null, tint = Color(0xFF3159D8), modifier = Modifier.size(18.dp))
                            Text("  ${session.sessionDate}", color = Color(0xFF3159D8), fontWeight = FontWeight.Bold, fontSize = 12.sp)
                        }
                    }
                }
            }
            if (session.safety.isNotEmpty()) {
                Row(
                    Modifier.fillMaxWidth().clickable { safetyExpanded = !safetyExpanded }.padding(vertical = 2.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Icon(
                        if (safetyExpanded) Icons.Outlined.ExpandLess else Icons.Outlined.ExpandMore,
                        contentDescription = null,
                        modifier = Modifier.size(16.dp)
                    )
                    Spacer(Modifier.width(2.dp))
                    Text("Session safety", fontSize = 12.sp, fontWeight = FontWeight.Medium)
                }
                if (safetyExpanded) {
                    Column(Modifier.padding(start = 18.dp, top = 2.dp, bottom = 4.dp)) {
                        session.safety.forEach { item -> Text("• $item", fontSize = 12.sp) }
                    }
                }
            }
            if (plannedDrillTitles.isNotEmpty()) {
                Row(
                    Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()).padding(top = 4.dp, bottom = 4.dp),
                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    plannedDrillTitles.forEach { name ->
                        Surface(shape = RoundedCornerShape(50), color = MaterialTheme.colorScheme.primary.copy(alpha = 0.10f)) {
                            Text(name, fontSize = 11.sp, color = MaterialTheme.colorScheme.primary, modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp))
                        }
                    }
                }
            }
            val canManage = canDeleteAny || (canCoachSessions && session.isAssignedTo(userId))
            HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant, modifier = Modifier.padding(top = 4.dp, bottom = 6.dp))
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                Text("${plannedDrillIds.size} Planned Drills", fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f))
                Row(
                    Modifier.horizontalScroll(rememberScrollState()),
                    horizontalArrangement = Arrangement.spacedBy(4.dp, Alignment.End)
                ) {
                    if (!session.isExecuted && canManage) {
                        SessionIconAction(Icons.Outlined.Edit, "Edit", { onEdit(session) })
                        SessionIconAction(Icons.Outlined.Delete, "Delete", onDelete, danger = true)
                    }
                    if (canManage && !session.isPublished && !session.isExecuted) SessionIconAction(Icons.Outlined.Publish, "Publish", { onPublish(session) })
                    if (canCoachSessions && session.isAssignedTo(userId) && session.isPublished && !session.isExecuted) SessionIconAction(Icons.Outlined.PlayArrow, "Run", { onExecute(session) })
                    if (canCoachSessions && session.isAssignedTo(userId) && session.isExecuted) SessionIconAction(Icons.Outlined.Visibility, "Review", { onReview(session) })
                }
            }
        }
    }
}

@Composable
private fun EkotaDropdownFilter(
    label: String,
    selected: String,
    options: List<Pair<String, String>>,
    modifier: Modifier = Modifier,
    onSelect: (String) -> Unit
) {
    var expanded by remember(label) { mutableStateOf(false) }
    Box(modifier) {
        OutlinedButton(
            onClick = { expanded = true },
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(16.dp)
        ) {
            Icon(Icons.Outlined.FilterList, contentDescription = null, modifier = Modifier.size(18.dp))
            Text("  $label: ${options.firstOrNull { it.first == selected }?.second ?: selected}", modifier = Modifier.weight(1f), maxLines = 1, overflow = TextOverflow.Ellipsis, fontSize = 12.sp)
            Icon(Icons.Outlined.ExpandMore, contentDescription = null, modifier = Modifier.size(18.dp))
        }
        DropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }) {
            options.forEach { (value, text) ->
                DropdownMenuItem(
                    text = { Text(text) },
                    onClick = {
                        onSelect(value)
                        expanded = false
                    }
                )
            }
        }
    }
}

@Composable
private fun AssessmentsPanel(
    assessments: List<PlayerAssessment>,
    players: List<ClubMember>,
    onSchedule: () -> Unit,
    onStart: (PlayerAssessment) -> Unit,
    onOpen: (PlayerAssessment) -> Unit,
    onEdit: (PlayerAssessment) -> Unit,
    onDelete: (PlayerAssessment) -> Unit,
    modifier: Modifier = Modifier
) {
    var search by remember { mutableStateOf("") }
    var status by remember { mutableStateOf("ALL") }
    var discipline by remember { mutableStateOf("ALL") }
    var deleteTarget by remember { mutableStateOf<PlayerAssessment?>(null) }
    val filteredAssessments = assessments.filter { assessment ->
        (assessment.title.contains(search.trim(), ignoreCase = true) || assessment.playerName.contains(search.trim(), ignoreCase = true)) &&
            (status == "ALL" || status == assessment.status) &&
            (discipline == "ALL" || discipline == assessment.discipline)
    }
    BoxWithConstraints(modifier) {
        val isTablet = maxWidth >= 600.dp
        LazyColumn(Modifier.fillMaxSize(), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            item {
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End, verticalAlignment = Alignment.CenterVertically) {
                    Button(onClick = onSchedule, enabled = players.isNotEmpty(), shape = RoundedCornerShape(14.dp)) {
                        Icon(Icons.Outlined.Add, contentDescription = null, modifier = Modifier.size(20.dp))
                        Text("  Schedule assessment", fontWeight = FontWeight.Bold, fontSize = 12.sp)
                        Icon(Icons.Outlined.CalendarMonth, contentDescription = null, modifier = Modifier.padding(start = 4.dp).size(18.dp))
                    }
                }
                if (isTablet) {
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                        WorkspaceField(search, { search = it }, "Search by player or title…", Modifier.weight(1.4f))
                        EkotaDropdownFilter("Status", status, listOf("ALL" to "All", "SCHEDULED" to "Scheduled", "IN_PROGRESS" to "In progress", "COMPLETED" to "Completed"), Modifier.weight(1f)) { status = it }
                        EkotaDropdownFilter("Discipline", discipline, (listOf("ALL" to "All") + ClubDisciplines.map { it to it.lowercase().replaceFirstChar(Char::uppercase) }), Modifier.weight(1f)) { discipline = it }
                    }
                } else {
                    WorkspaceField(search, { search = it }, "Search by player or title…", Modifier.fillMaxWidth())
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        EkotaDropdownFilter("Status", status, listOf("ALL" to "All", "SCHEDULED" to "Scheduled", "IN_PROGRESS" to "In progress", "COMPLETED" to "Completed"), Modifier.weight(1f)) { status = it }
                        EkotaDropdownFilter("Discipline", discipline, (listOf("ALL" to "All") + ClubDisciplines.map { it to it.lowercase().replaceFirstChar(Char::uppercase) }), Modifier.weight(1f)) { discipline = it }
                    }
                }
            }
            if (filteredAssessments.isEmpty()) {
                item { EmptyMessage(if (assessments.isEmpty()) "No assessments scheduled yet." else "No assessments match these filters.") }
            } else if (isTablet) {
                items(filteredAssessments.chunked(2)) { pair ->
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        pair.forEach { assessment ->
                            AssessmentCard(
                                assessment = assessment,
                                onStart = onStart,
                                onOpen = onOpen,
                                onEdit = onEdit,
                                onDelete = { deleteTarget = assessment },
                                modifier = Modifier.weight(1f)
                            )
                        }
                        if (pair.size == 1) Spacer(Modifier.weight(1f))
                    }
                }
            } else {
                items(filteredAssessments, key = PlayerAssessment::id) { assessment ->
                    AssessmentCard(
                        assessment = assessment,
                        onStart = onStart,
                        onOpen = onOpen,
                        onEdit = onEdit,
                        onDelete = { deleteTarget = assessment },
                        modifier = Modifier.fillMaxWidth()
                    )
                }
            }
        }
    }
    deleteTarget?.let { assessment ->
        AlertDialog(
            onDismissRequest = { deleteTarget = null },
            title = { Text("Delete assessment?") },
            text = { Text("Permanently delete '${assessment.title}' for ${assessment.playerName}? This cannot be undone.") },
            confirmButton = {
                Button(
                    onClick = {
                        deleteTarget = null
                        onDelete(assessment)
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFDC2626), contentColor = Color.White)
                ) { Text("Delete assessment") }
            },
            dismissButton = { TextButton(onClick = { deleteTarget = null }) { Text("Keep assessment") } }
        )
    }
}

@Composable
private fun AssessmentCard(
    assessment: PlayerAssessment,
    onStart: (PlayerAssessment) -> Unit,
    onOpen: (PlayerAssessment) -> Unit,
    onEdit: (PlayerAssessment) -> Unit,
    onDelete: () -> Unit,
    modifier: Modifier = Modifier
) {
    var menuOpen by remember(assessment.id) { mutableStateOf(false) }
    val disciplineColor = when (assessment.discipline.uppercase()) {
        "BATTING" -> Color(0xFF2679F4)
        "BOWLING" -> Color(0xFF7541E8)
        "FIELDING" -> Color(0xFFE59A12)
        "KEEPING" -> Color(0xFF13A875)
        else -> EkotaOverviewColors.primary
    }
    val statusColor = when (assessment.status) {
        "COMPLETED" -> Color(0xFF12A875)
        "IN_PROGRESS" -> Color(0xFFE59A12)
        else -> Color(0xFF2679F4)
    }
    val initials = assessment.playerName.split(Regex("\\s+")).filter(String::isNotBlank).take(2).mapNotNull { it.firstOrNull()?.uppercaseChar() }.joinToString("").ifBlank { "?" }
    val avatarColors = listOf(Color(0xFFBFD8FF), Color(0xFFDAD0FF), Color(0xFFC6F0DE), Color(0xFFFFDFC4), Color(0xFFFFD5E5))
    val avatarColor = avatarColors[Math.floorMod(assessment.playerName.hashCode(), avatarColors.size)]
    Card(
        modifier = modifier.clickable(enabled = assessment.status != "SCHEDULED") { onOpen(assessment) },
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        shape = RoundedCornerShape(18.dp),
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.8f)),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Column(Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 10.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Surface(shape = CircleShape, color = avatarColor, modifier = Modifier.size(38.dp)) {
                    Box(contentAlignment = Alignment.Center) {
                        Text(initials, color = Color(0xFF29385D), fontSize = 14.sp, fontWeight = FontWeight.Bold)
                    }
                }
                Column(Modifier.weight(1f).padding(start = 9.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        Text(assessment.playerName, color = MaterialTheme.colorScheme.onSurface, fontSize = 16.sp, fontWeight = FontWeight.ExtraBold, maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.weight(1f, fill = false))
                        Surface(shape = RoundedCornerShape(50), color = disciplineColor.copy(alpha = 0.11f)) {
                            Text(assessment.discipline, color = disciplineColor, fontSize = 12.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(horizontal = 8.dp, vertical = 2.dp))
                        }
                    }
                    Text(assessment.title, color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 14.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
                }
                Box {
                    IconButton(onClick = { menuOpen = true }, modifier = Modifier.size(28.dp)) {
                        Icon(Icons.Outlined.MoreVert, contentDescription = "Assessment options", tint = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.size(18.dp))
                    }
                    DropdownMenu(expanded = menuOpen, onDismissRequest = { menuOpen = false }) {
                        DropdownMenuItem(text = { Text("Edit") }, leadingIcon = { Icon(Icons.Outlined.Edit, contentDescription = null) }, onClick = { menuOpen = false; onEdit(assessment) })
                        DropdownMenuItem(text = { Text("Delete") }, leadingIcon = { Icon(Icons.Outlined.Delete, contentDescription = null, tint = MaterialTheme.colorScheme.error) }, onClick = { menuOpen = false; onDelete() })
                    }
                }
            }
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                Icon(Icons.Outlined.CalendarMonth, contentDescription = null, tint = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.size(18.dp))
                Text("  ${assessment.scheduledDate}${assessment.scheduledTime?.let { " at $it" } ?: ""}", color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 14.sp, modifier = Modifier.weight(1f), maxLines = 1, overflow = TextOverflow.Ellipsis)
                Surface(shape = RoundedCornerShape(50), color = statusColor.copy(alpha = 0.13f)) {
                    Text(assessment.status.replace('_', ' ').lowercase().replaceFirstChar(Char::uppercase), color = statusColor, fontSize = 12.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp))
                }
            }
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(7.dp, Alignment.End)) {
                AssessmentActionButton("Delete", Icons.Outlined.Delete, Color(0xFFDC2626), onClick = onDelete)
                AssessmentActionButton("Edit", Icons.Outlined.Edit, Color(0xFF2679F4), onClick = { onEdit(assessment) })
                when (assessment.status) {
                    "SCHEDULED" -> AssessmentActionButton("Start", Icons.Outlined.PlayArrow, Color(0xFF7541E8), onClick = { onStart(assessment) }, primary = true)
                    "IN_PROGRESS" -> AssessmentActionButton("Continue", Icons.Outlined.PlayArrow, Color(0xFF7541E8), onClick = { onOpen(assessment) }, primary = true)
                    "COMPLETED" -> AssessmentActionButton("View", Icons.Outlined.Visibility, Color(0xFF7541E8), onClick = { onOpen(assessment) }, primary = true)
                }
            }
        }
    }
}

@Composable
private fun AssessmentActionButton(
    label: String,
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    accent: Color,
    primary: Boolean = false,
    onClick: () -> Unit
) {
    Surface(onClick = onClick, shape = RoundedCornerShape(16.dp), color = if (primary) accent else accent.copy(alpha = 0.1f)) {
        Row(Modifier.padding(horizontal = 12.dp, vertical = 6.dp), horizontalArrangement = Arrangement.spacedBy(5.dp), verticalAlignment = Alignment.CenterVertically) {
            Icon(icon, contentDescription = null, tint = if (primary) Color.White else accent, modifier = Modifier.size(17.dp))
            Text(label, color = if (primary) Color.White else accent, fontWeight = FontWeight.Bold, fontSize = 14.sp)
        }
    }
}

@Composable
private fun EditAssessmentPanel(
    assessment: PlayerAssessment,
    isSaving: Boolean,
    saveError: String,
    onSave: (String, String, String) -> Unit,
    onDelete: () -> Unit,
    onBack: () -> Unit,
    modifier: Modifier = Modifier
) {
    var title by remember(assessment.id) { mutableStateOf(assessment.title) }
    var scheduledDate by remember(assessment.id) { mutableStateOf(assessment.scheduledDate) }
    var scheduledTime by remember(assessment.id) { mutableStateOf(assessment.scheduledTime.orEmpty()) }
    var deleteConfirm by remember { mutableStateOf(false) }
    LazyColumn(modifier, verticalArrangement = Arrangement.spacedBy(10.dp)) {
        item {
            Row(verticalAlignment = Alignment.CenterVertically) {
                IconButton(onClick = onBack) { Icon(Icons.AutoMirrored.Outlined.ArrowBack, contentDescription = "Back") }
                Text("Edit assessment", color = MaterialTheme.colorScheme.primary, fontSize = 20.sp, fontWeight = FontWeight.Bold)
            }
        }
        item {
            Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)) {
                Column(Modifier.fillMaxWidth().padding(14.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    Text("${assessment.playerName} · ${assessment.discipline}", fontSize = 12.sp, color = MaterialTheme.colorScheme.primary)
                    WorkspaceField(title, { title = it }, "Assessment title", Modifier.fillMaxWidth(), enabled = !isSaving)
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        DateField(scheduledDate, { scheduledDate = it }, "Scheduled date", Modifier.weight(1f), enabled = !isSaving)
                        TimeField(scheduledTime, { scheduledTime = it }, "Time (optional)", Modifier.weight(1f), enabled = !isSaving)
                    }
                    if (saveError.isNotBlank()) Text(saveError, color = MaterialTheme.colorScheme.error, fontSize = 12.sp)
                    HorizontalDivider(color = MaterialTheme.colorScheme.primary.copy(alpha = 0.3f), modifier = Modifier.padding(top = 4.dp, bottom = 4.dp))
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(2.dp, Alignment.End)) {
                        WorkspaceAction("Delete", Icons.Outlined.Delete, { deleteConfirm = true }, enabled = !isSaving)
                        WorkspaceAction(
                            "Save",
                            Icons.Outlined.CheckCircle,
                            { onSave(title.trim(), scheduledDate.trim(), scheduledTime.trim()) },
                            enabled = !isSaving && title.isNotBlank() && isIsoDate(scheduledDate),
                            primary = true
                        )
                    }
                }
            }
        }
    }
    if (deleteConfirm) {
        AlertDialog(
            onDismissRequest = { deleteConfirm = false },
            title = { Text("Delete assessment?") },
            text = { Text("Permanently delete '${assessment.title}' for ${assessment.playerName}? This cannot be undone.") },
            confirmButton = {
                Button(
                    onClick = { deleteConfirm = false; onDelete() },
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFDC2626), contentColor = Color.White)
                ) { Text("Delete assessment") }
            },
            dismissButton = { TextButton(onClick = { deleteConfirm = false }) { Text("Keep assessment") } }
        )
    }
}

@Composable
private fun ReadOnlyDrills(drills: List<Drill>, modifier: Modifier = Modifier) {
    LazyColumn(modifier, verticalArrangement = Arrangement.spacedBy(10.dp)) {
        item { Text("Drill catalogue", color = MaterialTheme.colorScheme.primary, fontSize = 20.sp, fontWeight = FontWeight.Bold) }
        if (drills.isEmpty()) item { EmptyMessage("No drills are available. Sync while online to load the catalogue.") }
        items(drills, key = Drill::id) { drill ->
            InfoCard(drill.title, "${drill.discipline} · ${drill.durationMinutes} min", listOf(drill.skillSet, drill.instructions).filter(String::isNotBlank).joinToString("\n"))
        }
    }
}

@Composable
private fun ReadOnlyTemplates(templates: List<TrainingTemplate>, modifier: Modifier = Modifier) {
    LazyColumn(modifier, verticalArrangement = Arrangement.spacedBy(10.dp)) {
        item { Text("Training templates", color = MaterialTheme.colorScheme.primary, fontSize = 20.sp, fontWeight = FontWeight.Bold) }
        if (templates.isEmpty()) item { EmptyMessage("No shared training templates are available.") }
        items(templates, key = TrainingTemplate::id) { template ->
            InfoCard(template.title, "${template.durationMinutes} min · ${template.disciplines.joinToString()}", template.focus)
        }
    }
}

@Composable
internal fun InfoCard(title: String, subtitle: String, details: String) {
    Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)) {
        Column(Modifier.fillMaxWidth().padding(14.dp)) {
            Text(title, fontWeight = FontWeight.SemiBold)
            Text(subtitle, fontSize = 12.sp, color = MaterialTheme.colorScheme.primary)
            if (details.isNotBlank()) Text(details, fontSize = 12.sp, modifier = Modifier.padding(top = 4.dp))
        }
    }
}

@Composable
private fun EmptyMessage(message: String) {
    Text(message, color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.7f), modifier = Modifier.padding(vertical = 12.dp))
}

@Composable
private fun InviteMemberDialog(
    onDismiss: () -> Unit,
    onSave: (String, String, String, String, String) -> Unit
) {
    var name by remember { mutableStateOf("") }
    var email by remember { mutableStateOf("") }
    var role by remember { mutableStateOf("PLAYER") }
    var ageGroup by remember { mutableStateOf("U15") }
    var discipline by remember { mutableStateOf("BATTING") }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Invite club member") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                WorkspaceField(name, { name = it }, "Name")
                WorkspaceField(email, { email = it }, "Email")
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text("Role: $role", modifier = Modifier.weight(1f))
                    TextButton(onClick = { role = if (role == "PLAYER") "COACH" else "PLAYER" }) { Text("Change") }
                }
                if (role == "PLAYER") {
                    WorkspaceField(ageGroup, { ageGroup = it }, "Age group")
                    DisciplinePicker(discipline) { discipline = it }
                }
            }
        },
        confirmButton = {
            Button(onClick = { onSave(name.trim(), email.trim(), role, ageGroup.trim(), discipline) }, enabled = name.isNotBlank() && email.contains("@")) {
                Text("Send invite")
            }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Cancel") } }
    )
}

@Composable
private fun CreateSquadDialog(onDismiss: () -> Unit, onSave: (String, String, List<String>) -> Unit) {
    var name by remember { mutableStateOf("") }
    var ageGroup by remember { mutableStateOf("U15") }
    val selected = remember { mutableStateMapOf<String, Boolean>().apply { ClubDisciplines.forEach { put(it, it == "BATTING") } } }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Create squad") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(5.dp)) {
                WorkspaceField(name, { name = it }, "Squad name")
                WorkspaceField(ageGroup, { ageGroup = it }, "Age group")
                Text("Disciplines")
                ClubDisciplines.forEach { discipline ->
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Checkbox(checked = selected[discipline] == true, onCheckedChange = { selected[discipline] = it })
                        Text(discipline)
                    }
                }
            }
        },
        confirmButton = {
            Button(
                onClick = { onSave(name.trim(), ageGroup.trim(), selected.filterValues { it }.keys.toList()) },
                enabled = name.isNotBlank() && selected.values.any { it }
            ) { Text("Create") }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Cancel") } }
    )
}

@Composable
private fun PlannedDrillChip(name: String, onRemove: () -> Unit, modifier: Modifier = Modifier) {
    Surface(shape = RoundedCornerShape(50), color = MaterialTheme.colorScheme.primary.copy(alpha = 0.12f), modifier = modifier) {
        Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(start = 10.dp, end = 4.dp, top = 2.dp, bottom = 2.dp)) {
            Text(name, fontSize = 12.sp, color = MaterialTheme.colorScheme.primary, fontWeight = FontWeight.Medium)
            IconButton(onClick = onRemove, modifier = Modifier.size(22.dp).padding(start = 2.dp)) {
                Icon(Icons.Outlined.Close, contentDescription = "Remove drill", tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(14.dp))
            }
        }
    }
}

@Composable
private fun AvailableDrillsPanel(
    allDrills: List<Drill>,
    isBusy: Boolean,
    onAdd: (Drill) -> Unit,
    modifier: Modifier = Modifier,
    selectedIds: List<String> = emptyList(),
    onRemove: ((String) -> Unit)? = null
) {
    var filter by remember { mutableStateOf("ALL") }
    var filterMenuOpen by remember { mutableStateOf(false) }
    val filtered = allDrills.filter { filter == "ALL" || it.discipline.equals(filter, ignoreCase = true) }
    Card(modifier = modifier, colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)) {
        Column(Modifier.fillMaxSize().padding(14.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Text("Available Drills", fontWeight = FontWeight.SemiBold)
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text("Discipline: ")
                TextButton(onClick = { filterMenuOpen = true }) { Text(filter) }
                DropdownMenu(expanded = filterMenuOpen, onDismissRequest = { filterMenuOpen = false }) {
                    (listOf("ALL") + ClubDisciplines).forEach { value ->
                        DropdownMenuItem(text = { Text(value) }, onClick = { filter = value; filterMenuOpen = false })
                    }
                }
            }
            if (filtered.isEmpty()) {
                EmptyMessage("No drills available for this filter.")
            } else {
                Column(Modifier.weight(1f, fill = false).verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    filtered.forEach { drill ->
                        Row(
                            Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Column(Modifier.weight(1f).padding(end = 6.dp)) {
                                Text(drill.title, fontSize = 13.sp, fontWeight = FontWeight.Medium)
                                Text(
                                    "${drill.discipline} · ${drill.durationMinutes} min",
                                    fontSize = 11.sp,
                                    color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f)
                                )
                            }
                            val added = drill.id in selectedIds
                            val canToggle = !isBusy && (!added || onRemove != null)
                            val accent = if (added) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.primary
                            Surface(
                                onClick = { if (added) onRemove?.invoke(drill.id) else onAdd(drill) },
                                enabled = canToggle,
                                shape = CircleShape,
                                color = accent.copy(alpha = if (added) 0.12f else 0.14f),
                                border = androidx.compose.foundation.BorderStroke(1.dp, accent.copy(alpha = if (canToggle) 0.7f else 0.3f)),
                                modifier = Modifier.size(32.dp)
                            ) {
                                Box(contentAlignment = Alignment.Center) {
                                    Icon(
                                        if (added) Icons.Outlined.Remove else Icons.Outlined.Add,
                                        contentDescription = if (added) "Remove ${drill.title}" else "Add ${drill.title}",
                                        tint = accent.copy(alpha = if (canToggle) 1f else 0.4f),
                                        modifier = Modifier.size(18.dp)
                                    )
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun SessionDetailsCard(
    session: ClubTrainingSession,
    title: String,
    onTitleChange: (String) -> Unit,
    date: String,
    onDateChange: (String) -> Unit,
    duration: String,
    onDurationChange: (String) -> Unit,
    safety: String,
    onSafetyChange: (String) -> Unit,
    squads: List<ClubSquad>,
    selectedSquad: ClubSquad?,
    onSquadChange: (ClubSquad?) -> Unit,
    coaches: List<ClubMember>,
    selectedCoach: ClubMember?,
    onCoachChange: (ClubMember?) -> Unit,
    allDrills: List<Drill>,
    isSaving: Boolean,
    saveError: String,
    onSave: () -> Unit,
    onDeleteRequest: () -> Unit,
    onRemoveDrill: (String) -> Unit,
    modifier: Modifier = Modifier
) {
    var squadMenuOpen by remember { mutableStateOf(false) }
    var coachMenuOpen by remember { mutableStateOf(false) }
    val minutes = duration.toIntOrNull() ?: 0
    Card(modifier = modifier, colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)) {
        Column(Modifier.fillMaxWidth().padding(14.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            WorkspaceField(title, onTitleChange, "Session title", Modifier.fillMaxWidth(), enabled = !isSaving)
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text("Squad: ${selectedSquad?.name ?: "All players"}", fontSize = 13.sp, modifier = Modifier.weight(1f))
                TextButton(onClick = { squadMenuOpen = true }, enabled = !isSaving) { Text("Change") }
                DropdownMenu(expanded = squadMenuOpen, onDismissRequest = { squadMenuOpen = false }) {
                    DropdownMenuItem(text = { Text("All players") }, onClick = { onSquadChange(null); squadMenuOpen = false })
                    squads.forEach { squad ->
                        DropdownMenuItem(text = { Text(squad.name) }, onClick = { onSquadChange(squad); squadMenuOpen = false })
                    }
                }
            }
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text("Head Coach: ${selectedCoach?.name ?: "Unassigned"}", fontSize = 13.sp, modifier = Modifier.weight(1f))
                TextButton(onClick = { coachMenuOpen = true }, enabled = !isSaving && coaches.isNotEmpty()) { Text("Change") }
                DropdownMenu(expanded = coachMenuOpen, onDismissRequest = { coachMenuOpen = false }) {
                    coaches.forEach { coach ->
                        DropdownMenuItem(text = { Text(coach.name) }, onClick = { onCoachChange(coach); coachMenuOpen = false })
                    }
                }
            }
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                DateField(date, onDateChange, "Date", Modifier.weight(1f), enabled = !isSaving)
                WorkspaceField(duration, onDurationChange, "Duration in minutes", Modifier.weight(1f), enabled = !isSaving)
            }
            WorkspaceField(safety, onSafetyChange, "Safety instructions (one per line)", Modifier.fillMaxWidth(), singleLine = false, enabled = !isSaving)
            Text("Planned Drills (${session.drillIds.size})", fontWeight = FontWeight.SemiBold)
            if (session.drillIds.isEmpty()) {
                Text("No drills added yet.", fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f))
            } else {
                Row(Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    session.drillIds.forEach { drillId ->
                        val drillName = allDrills.find { it.id == drillId }?.title ?: "Unknown Drill"
                        PlannedDrillChip(drillName, onRemove = { onRemoveDrill(drillId) })
                    }
                }
            }
            if (saveError.isNotBlank()) Text(saveError, color = MaterialTheme.colorScheme.error, fontSize = 12.sp)
            HorizontalDivider(color = MaterialTheme.colorScheme.primary.copy(alpha = 0.3f), modifier = Modifier.padding(top = 4.dp, bottom = 4.dp))
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(2.dp, Alignment.End)) {
                WorkspaceAction("Delete", Icons.Outlined.Delete, onDeleteRequest, enabled = !isSaving)
                WorkspaceAction(
                    "Save",
                    Icons.Outlined.CheckCircle,
                    onSave,
                    enabled = !isSaving && title.isNotBlank() && isIsoDate(date) && minutes in 15..600,
                    primary = true
                )
            }
        }
    }
}

@Composable
private fun EditSessionPanel(
    session: ClubTrainingSession,
    squads: List<ClubSquad>,
    coaches: List<ClubMember>,
    allDrills: List<Drill>,
    isSaving: Boolean,
    saveError: String,
    drillBusy: Boolean,
    onSave: (String, String, Int, ClubSquad?, ClubMember?, List<String>) -> Unit,
    onDelete: () -> Unit,
    onAddDrill: (Drill) -> Unit,
    onRemoveDrill: (String) -> Unit,
    onBack: () -> Unit,
    modifier: Modifier = Modifier
) {
    var title by remember(session.id) { mutableStateOf(session.title) }
    var date by remember(session.id) { mutableStateOf(session.sessionDate) }
    var duration by remember(session.id) { mutableStateOf(session.durationMinutes.toString()) }
    var safety by remember(session.id) { mutableStateOf(session.safety.joinToString("\n")) }
    var selectedSquad by remember(session.id) { mutableStateOf(squads.find { it.id == session.squadId }) }
    var selectedCoach by remember(session.id) { mutableStateOf(coaches.find { it.id == session.coachId }) }
    var deleteConfirm by remember { mutableStateOf(false) }
    var showDrillPicker by remember { mutableStateOf(false) }

    BoxWithConstraints(modifier) {
        val isTablet = maxWidth >= 600.dp
        Column(Modifier.fillMaxSize()) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                IconButton(onClick = onBack) { Icon(Icons.AutoMirrored.Outlined.ArrowBack, contentDescription = "Back") }
                Text("Edit session", color = MaterialTheme.colorScheme.primary, fontSize = 20.sp, fontWeight = FontWeight.Bold)
            }
            Spacer(Modifier.height(10.dp))
            if (isTablet) {
                Row(Modifier.fillMaxSize(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    SessionDetailsCard(
                        session = session,
                        title = title, onTitleChange = { title = it },
                        date = date, onDateChange = { date = it },
                        duration = duration, onDurationChange = { duration = it.filter(Char::isDigit) },
                        safety = safety, onSafetyChange = { safety = it },
                        squads = squads, selectedSquad = selectedSquad, onSquadChange = { selectedSquad = it },
                        coaches = coaches, selectedCoach = selectedCoach, onCoachChange = { selectedCoach = it },
                        allDrills = allDrills,
                        isSaving = isSaving,
                        saveError = saveError,
                        onSave = {
                            onSave(
                                title.trim(),
                                date,
                                duration.toIntOrNull() ?: 0,
                                selectedSquad,
                                selectedCoach,
                                safety.lines().map(String::trim).filter(String::isNotBlank)
                            )
                        },
                        onDeleteRequest = { deleteConfirm = true },
                        onRemoveDrill = onRemoveDrill,
                        modifier = Modifier.weight(1f).fillMaxHeight().verticalScroll(rememberScrollState())
                    )
                    AvailableDrillsPanel(
                        allDrills = allDrills,
                        isBusy = drillBusy,
                        onAdd = onAddDrill,
                        modifier = Modifier.weight(1f).fillMaxHeight(),
                        selectedIds = session.drillIds,
                        onRemove = onRemoveDrill
                    )
                }
            } else {
                Column(Modifier.fillMaxWidth().verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    SessionDetailsCard(
                        session = session,
                        title = title, onTitleChange = { title = it },
                        date = date, onDateChange = { date = it },
                        duration = duration, onDurationChange = { duration = it.filter(Char::isDigit) },
                        safety = safety, onSafetyChange = { safety = it },
                        squads = squads, selectedSquad = selectedSquad, onSquadChange = { selectedSquad = it },
                        coaches = coaches, selectedCoach = selectedCoach, onCoachChange = { selectedCoach = it },
                        allDrills = allDrills,
                        isSaving = isSaving,
                        saveError = saveError,
                        onSave = {
                            onSave(
                                title.trim(),
                                date,
                                duration.toIntOrNull() ?: 0,
                                selectedSquad,
                                selectedCoach,
                                safety.lines().map(String::trim).filter(String::isNotBlank)
                            )
                        },
                        onDeleteRequest = { deleteConfirm = true },
                        onRemoveDrill = onRemoveDrill,
                        modifier = Modifier.fillMaxWidth()
                    )
                    WorkspaceAction("Manage drills (${session.drillIds.size})", Icons.Outlined.FitnessCenter, { showDrillPicker = true })
                }
            }
        }
    }
    if (showDrillPicker) {
        AlertDialog(
            onDismissRequest = { showDrillPicker = false },
            title = { Text("Available drills") },
            text = {
                AvailableDrillsPanel(
                    allDrills = allDrills,
                    isBusy = drillBusy,
                    onAdd = onAddDrill,
                    modifier = Modifier.height(380.dp),
                    selectedIds = session.drillIds,
                    onRemove = onRemoveDrill
                )
            },
            confirmButton = { TextButton(onClick = { showDrillPicker = false }) { Text("Done") } }
        )
    }
    if (deleteConfirm) {
        AlertDialog(
            onDismissRequest = { deleteConfirm = false },
            title = { Text("Delete scheduled session?") },
            text = { Text("Permanently delete '${session.title}'? This cannot be undone.") },
            confirmButton = { Button(onClick = { deleteConfirm = false; onDelete() }) { Text("Delete session") } },
            dismissButton = { TextButton(onClick = { deleteConfirm = false }) { Text("Keep session") } }
        )
    }
}

@Composable
private fun ScheduleSessionPanel(
    squads: List<ClubSquad>,
    players: List<ClubMember>,
    coaches: List<ClubMember>,
    allDrills: List<Drill>,
    templates: List<TrainingTemplate>,
    isSaving: Boolean,
    saveError: String,
    onBack: () -> Unit,
    onSave: (JSONObject) -> Unit
) {
    var title by remember { mutableStateOf("") }
    var targetType by remember { mutableStateOf("SQUAD") }
    var selectedSquad by remember { mutableStateOf(squads.firstOrNull()) }
    val selectedPlayerIds = remember { mutableStateListOf<String>() }
    var selectedCoach by remember { mutableStateOf<ClubMember?>(null) }
    var selectedCoordinator by remember { mutableStateOf<ClubMember?>(null) }
    var selectedAssistant by remember { mutableStateOf<ClubMember?>(null) }
    var date by remember { mutableStateOf(LocalDate.now().toString()) }
    var duration by remember { mutableStateOf("90") }
    var safety by remember { mutableStateOf("") }
    val drillIds = remember { mutableStateListOf<String>() }

    BoxWithConstraints(Modifier.fillMaxSize()) {
        val isTablet = maxWidth >= 600.dp
        Column(Modifier.fillMaxSize()) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                IconButton(onClick = onBack) { Icon(Icons.AutoMirrored.Outlined.ArrowBack, contentDescription = "Back") }
                Text("Schedule training session", color = MaterialTheme.colorScheme.primary, fontSize = 20.sp, fontWeight = FontWeight.Bold)
            }
            Spacer(Modifier.height(10.dp))
            val form: @Composable (Modifier) -> Unit = { formModifier ->
                Column(formModifier, verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    if (templates.isNotEmpty()) {
                        SharedTemplatePickerCard(templates) { template ->
                            title = template.title
                            duration = template.durationMinutes.takeIf { it > 0 }?.toString() ?: duration
                            safety = template.safety.joinToString("\n")
                            drillIds.clear()
                            drillIds.addAll(template.drillIds)
                        }
                    }
                    Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)) {
                        Column(Modifier.fillMaxWidth().padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            WorkspaceField(title, { title = it }, "Session title *", Modifier.fillMaxWidth(), enabled = !isSaving)
                            Text("Assign Training To", fontSize = 11.sp, fontWeight = FontWeight.SemiBold, color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.7f))
                            Row(
                                Modifier
                                    .fillMaxWidth()
                                    .background(MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.4f), RoundedCornerShape(12.dp))
                                    .padding(3.dp)
                            ) {
                                listOf("SQUAD" to "Existing Squad", "PLAYERS" to "Individual Player(s)").forEach { (value, label) ->
                                    val selected = targetType == value
                                    Surface(
                                        shape = RoundedCornerShape(10.dp),
                                        color = if (selected) MaterialTheme.colorScheme.primary else Color.Transparent,
                                        modifier = Modifier.weight(1f).clickable(enabled = !isSaving) { targetType = value }
                                    ) {
                                        Text(
                                            label,
                                            fontSize = 12.sp,
                                            fontWeight = FontWeight.SemiBold,
                                            color = if (selected) MaterialTheme.colorScheme.onPrimary else MaterialTheme.colorScheme.onSurface.copy(alpha = 0.7f),
                                            modifier = Modifier.padding(vertical = 8.dp),
                                            textAlign = androidx.compose.ui.text.style.TextAlign.Center
                                        )
                                    }
                                }
                            }
                            if (targetType == "SQUAD") {
                                if (squads.isEmpty()) {
                                    Text(
                                        "No squads formed yet. Switch to \"Individual Player(s)\" or form a squad first.",
                                        fontSize = 11.sp,
                                        color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f)
                                    )
                                } else {
                                    LabeledDropdown("Target Squad", selectedSquad?.name ?: "Select a squad", enabled = !isSaving) { close ->
                                        squads.forEach { squad ->
                                            DropdownMenuItem(text = { Text(squad.name) }, onClick = { selectedSquad = squad; close() })
                                        }
                                    }
                                }
                            } else {
                                Text(
                                    "Select Player(s)${if (selectedPlayerIds.isNotEmpty()) " (${selectedPlayerIds.size} selected)" else ""}",
                                    fontSize = 11.sp,
                                    fontWeight = FontWeight.SemiBold,
                                    color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.7f)
                                )
                                Column(
                                    Modifier
                                        .fillMaxWidth()
                                        .heightIn(max = 180.dp)
                                        .verticalScroll(rememberScrollState())
                                        .background(MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.3f), RoundedCornerShape(10.dp))
                                        .padding(6.dp)
                                ) {
                                    if (players.isEmpty()) {
                                        Text("No players in roster yet.", fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f), modifier = Modifier.padding(6.dp))
                                    }
                                    players.forEach { player ->
                                        val checked = player.id in selectedPlayerIds
                                        Row(
                                            Modifier
                                                .fillMaxWidth()
                                                .clickable(enabled = !isSaving) {
                                                    if (checked) selectedPlayerIds.remove(player.id) else selectedPlayerIds.add(player.id)
                                                }
                                                .padding(vertical = 4.dp, horizontal = 4.dp),
                                            verticalAlignment = Alignment.CenterVertically
                                        ) {
                                            Checkbox(checked = checked, onCheckedChange = { add ->
                                                if (add) selectedPlayerIds.add(player.id) else selectedPlayerIds.remove(player.id)
                                            }, enabled = !isSaving)
                                            Text(player.name, fontSize = 12.sp, modifier = Modifier.weight(1f))
                                        }
                                    }
                                }
                            }
                            HorizontalDivider(color = MaterialTheme.colorScheme.primary.copy(alpha = 0.15f))
                            LabeledDropdown("Head Coach *", selectedCoach?.name ?: "Select an active coach", enabled = !isSaving && coaches.isNotEmpty()) { close ->
                                coaches.forEach { coach ->
                                    DropdownMenuItem(text = { Text(coach.name) }, onClick = { selectedCoach = coach; close() })
                                }
                            }
                            if (coaches.isEmpty()) {
                                Text("No active coaches are available. Activate a coach invitation before scheduling a session.", fontSize = 11.sp, color = MaterialTheme.colorScheme.error)
                            }
                            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                Box(Modifier.weight(1f)) {
                                    LabeledDropdown("Coordinator", selectedCoordinator?.name ?: "None", enabled = !isSaving) { close ->
                                        DropdownMenuItem(text = { Text("None") }, onClick = { selectedCoordinator = null; close() })
                                        coaches.filter { it.id != selectedCoach?.id && it.id != selectedAssistant?.id }.forEach { coach ->
                                            DropdownMenuItem(text = { Text(coach.name) }, onClick = { selectedCoordinator = coach; close() })
                                        }
                                    }
                                }
                                Box(Modifier.weight(1f)) {
                                    LabeledDropdown("Assistant Coach", selectedAssistant?.name ?: "None", enabled = !isSaving) { close ->
                                        DropdownMenuItem(text = { Text("None") }, onClick = { selectedAssistant = null; close() })
                                        coaches.filter { it.id != selectedCoach?.id && it.id != selectedCoordinator?.id }.forEach { coach ->
                                            DropdownMenuItem(text = { Text(coach.name) }, onClick = { selectedAssistant = coach; close() })
                                        }
                                    }
                                }
                            }
                            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                DateField(date, { date = it }, "Date", Modifier.weight(1f), enabled = !isSaving)
                                WorkspaceField(duration, { duration = it.filter(Char::isDigit) }, "Duration (minutes)", Modifier.weight(1f), enabled = !isSaving)
                            }
                            WorkspaceField(safety, { safety = it }, "Session safety (one instruction per line)", Modifier.fillMaxWidth(), singleLine = false, enabled = !isSaving)
                            Text("Planned Drills (${drillIds.size})", fontWeight = FontWeight.SemiBold, fontSize = 13.sp)
                            if (drillIds.isEmpty()) {
                                Text("No drills added yet — pick from the panel.", fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f))
                            } else {
                                Row(Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                    drillIds.toList().forEachIndexed { index, drillId ->
                                        val drillName = allDrills.find { it.id == drillId }?.title ?: "Unknown Drill"
                                        PlannedDrillChip(drillName, onRemove = { drillIds.removeAt(index) })
                                    }
                                }
                            }
                            if (!isTablet) {
                                HorizontalDivider(color = MaterialTheme.colorScheme.primary.copy(alpha = 0.15f))
                                AvailableDrillsPanel(
                                    allDrills = allDrills,
                                    isBusy = false,
                                    onAdd = { drill -> if (drill.id !in drillIds) drillIds.add(drill.id) },
                                    modifier = Modifier.fillMaxWidth().height(260.dp),
                                    selectedIds = drillIds,
                                    onRemove = { drillIds.remove(it) }
                                )
                            }
                            if (saveError.isNotBlank()) Text(saveError, color = MaterialTheme.colorScheme.error, fontSize = 12.sp)
                            HorizontalDivider(color = MaterialTheme.colorScheme.primary.copy(alpha = 0.3f))
                            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(6.dp, Alignment.End)) {
                                WorkspaceAction("Cancel", Icons.Outlined.Close, onBack, enabled = !isSaving)
                                val minutes = duration.toIntOrNull() ?: 0
                                val valid = title.isNotBlank() && isIsoDate(date) && minutes in 15..240 && selectedCoach != null &&
                                    (targetType == "SQUAD" || selectedPlayerIds.isNotEmpty())
                                WorkspaceAction(
                                    if (isSaving) "Scheduling…" else "Schedule session",
                                    Icons.Outlined.CheckCircle,
                                    {
                                        val payload = JSONObject()
                                            .put("title", title.trim())
                                            .put("sessionDate", date)
                                            .put("durationMinutes", duration.toIntOrNull() ?: 90)
                                            .put("coachId", selectedCoach?.id)
                                            .put("coachName", selectedCoach?.name)
                                            .put("coordinatorCoachId", selectedCoordinator?.id ?: JSONObject.NULL)
                                            .put("coordinatorCoachName", selectedCoordinator?.name ?: JSONObject.NULL)
                                            .put("assistantCoachId", selectedAssistant?.id ?: JSONObject.NULL)
                                            .put("assistantCoachName", selectedAssistant?.name ?: JSONObject.NULL)
                                            .put("safety", JSONArray(safety.lines().map(String::trim).filter(String::isNotBlank)))
                                            .put("drillIds", JSONArray(drillIds.toList()))
                                        if (targetType == "SQUAD") {
                                            payload.put("squadId", selectedSquad?.id ?: JSONObject.NULL)
                                                .put("squadName", selectedSquad?.name ?: "All players")
                                                .put("assignedPlayerIds", JSONArray())
                                        } else {
                                            payload.put("squadId", JSONObject.NULL)
                                                .put("squadName", "Individual players")
                                                .put("assignedPlayerIds", JSONArray(selectedPlayerIds.toList()))
                                        }
                                        onSave(payload)
                                    },
                                    enabled = !isSaving && valid,
                                    primary = true
                                )
                            }
                        }
                    }
                }
            }
            if (isTablet) {
                Row(Modifier.fillMaxSize(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    form(Modifier.weight(1f).fillMaxHeight().verticalScroll(rememberScrollState()))
                    AvailableDrillsPanel(
                        allDrills = allDrills,
                        isBusy = false,
                        onAdd = { drill -> if (drill.id !in drillIds) drillIds.add(drill.id) },
                        modifier = Modifier.weight(1f).fillMaxHeight(),
                        selectedIds = drillIds,
                        onRemove = { drillIds.remove(it) }
                    )
                }
            } else {
                form(Modifier.fillMaxWidth().verticalScroll(rememberScrollState()))
            }
        }
    }
}

@Composable
private fun LabeledDropdown(
    label: String,
    valueText: String,
    enabled: Boolean = true,
    items: @Composable (close: () -> Unit) -> Unit
) {
    var open by remember { mutableStateOf(false) }
    Column {
        Text(label, fontSize = 11.sp, fontWeight = FontWeight.SemiBold, color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.7f))
        Row(
            Modifier
                .fillMaxWidth()
                .clickable(enabled = enabled) { open = true }
                .background(MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.3f), RoundedCornerShape(10.dp))
                .padding(horizontal = 10.dp, vertical = 10.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(valueText, fontSize = 12.sp, modifier = Modifier.weight(1f))
            Icon(Icons.Outlined.ExpandMore, contentDescription = null, modifier = Modifier.size(16.dp))
        }
        DropdownMenu(expanded = open, onDismissRequest = { open = false }) {
            items { open = false }
        }
    }
}

@Composable
private fun SharedTemplatePickerCard(templates: List<TrainingTemplate>, onApply: (TrainingTemplate) -> Unit) {
    var selected by remember { mutableStateOf<TrainingTemplate?>(null) }
    Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.primary.copy(alpha = 0.06f))) {
        Column(Modifier.fillMaxWidth().padding(12.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Text("Shared training templates", fontSize = 12.sp, fontWeight = FontWeight.SemiBold, color = MaterialTheme.colorScheme.primary)
            Text("Reusable activities available to every club and coach.", fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f))
            LabeledDropdown(label = "", valueText = selected?.title ?: "Choose a training activity") { close ->
                templates.forEach { template ->
                    DropdownMenuItem(text = { Text(template.title) }, onClick = { selected = template; close() })
                }
            }
            selected?.let { template ->
                Text(
                    "${template.disciplines.joinToString(", ")} · ${template.durationMinutes} min · ${template.drillIds.size} drills",
                    fontSize = 11.sp,
                    color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.7f)
                )
                if (template.focus.isNotBlank()) Text(template.focus, fontSize = 11.sp)
                Text(
                    "Applying replaces this draft's title, duration, safety instructions, and planned drills.",
                    fontSize = 10.sp,
                    color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.5f)
                )
                WorkspaceAction("Use template", Icons.Outlined.CheckCircle, { onApply(template) })
            }
        }
    }
}

@Composable
private fun ScheduleAssessmentDialog(
    players: List<ClubMember>,
    onDismiss: () -> Unit,
    onSave: (ClubMember, String, String, String, String) -> Unit
) {
    var selectedPlayer by remember { mutableStateOf(players.firstOrNull()) }
    var title by remember { mutableStateOf("Skills assessment") }
    var date by remember { mutableStateOf(LocalDate.now().toString()) }
    var time by remember { mutableStateOf("") }
    var discipline by remember { mutableStateOf(selectedPlayer?.discipline?.uppercase()?.takeIf(ClubDisciplines::contains) ?: "BATTING") }
    var menuOpen by remember { mutableStateOf(false) }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Schedule assessment") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(7.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(selectedPlayer?.name ?: "Select player", modifier = Modifier.weight(1f))
                    TextButton(onClick = { menuOpen = true }) { Text("Player") }
                    DropdownMenu(expanded = menuOpen, onDismissRequest = { menuOpen = false }) {
                        players.forEach { player ->
                            DropdownMenuItem(text = { Text(player.name) }, onClick = { selectedPlayer = player; menuOpen = false })
                        }
                    }
                }
                WorkspaceField(title, { title = it }, "Assessment title")
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    DateField(date, { date = it }, "Date", Modifier.weight(1f))
                    TimeField(time, { time = it }, "Time (optional)", Modifier.weight(1f))
                }
                DisciplinePicker(discipline) { discipline = it }
            }
        },
        confirmButton = {
            Button(
                onClick = { selectedPlayer?.let { onSave(it, title.trim(), date, time, discipline) } },
                enabled = selectedPlayer != null && title.isNotBlank() && isIsoDate(date)
            ) { Text("Schedule") }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Cancel") } }
    )
}

@Composable
private fun DisciplinePicker(value: String, onChange: (String) -> Unit) {
    var open by remember { mutableStateOf(false) }
    Row(verticalAlignment = Alignment.CenterVertically) {
        Text("Discipline: $value", modifier = Modifier.weight(1f))
        TextButton(onClick = { open = true }) { Text("Change") }
        DropdownMenu(expanded = open, onDismissRequest = { open = false }) {
            ClubDisciplines.forEach { discipline ->
                DropdownMenuItem(text = { Text(discipline) }, onClick = { onChange(discipline); open = false })
            }
        }
    }
}

@Composable
private fun AssessmentRunPanel(
    assessment: PlayerAssessment,
    isSaving: Boolean,
    isGeneratingInsights: Boolean,
    error: String,
    onSave: (metrics: List<AssessmentMetric>, strengths: String, focusAreas: String, coachFeedback: String, playerFeedback: String, complete: Boolean) -> Unit,
    onGenerateInsights: () -> Unit,
    onDownloadReport: () -> Unit,
    onShareReport: () -> Unit,
    onBack: () -> Unit,
    modifier: Modifier = Modifier,
    videoCard: (@Composable () -> Unit)? = null
) {
    val names = AssessmentMetricNames[assessment.discipline].orEmpty()
    val scores = remember(assessment.id) {
        mutableStateMapOf<String, Int>().also { state ->
            assessment.metrics.forEach { metric -> metric.score?.let { state[metric.name] = it } }
        }
    }
    val notes = remember(assessment.id) {
        mutableStateMapOf<String, String>().also { state -> assessment.metrics.forEach { state[it.name] = it.note } }
    }
    var strengths by remember(assessment.id) { mutableStateOf(assessment.strengths) }
    var focusAreas by remember(assessment.id) { mutableStateOf(assessment.focusAreas) }
    var coachFeedback by remember(assessment.id) { mutableStateOf(assessment.coachFeedback) }
    var playerFeedback by remember(assessment.id) { mutableStateOf(assessment.playerFeedback) }
    val completed = assessment.status == "COMPLETED"
    val editable = !completed && !isSaving
    fun currentMetrics() = names.map { AssessmentMetric(it, scores[it], notes[it].orEmpty().trim()) }
    val canComplete = names.all { scores[it] in 1..5 } && coachFeedback.isNotBlank()

    BoxWithConstraints(modifier) {
        val isTablet = maxWidth >= 600.dp
        LazyColumn(Modifier.fillMaxSize(), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            item {
                Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(top = 4.dp)) {
                    Text("Performance ratings", fontWeight = FontWeight.Bold, fontSize = 16.sp, color = MaterialTheme.colorScheme.onSurface)
                    Text("  (1 = needs work, 5 = strong)", fontSize = 14.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
            items(names, key = { "metric-$it" }) { name ->
                Surface(
                    shape = RoundedCornerShape(12.dp),
                    color = MaterialTheme.colorScheme.surface,
                    modifier = Modifier
                        .fillMaxWidth()
                        .border(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.25f), RoundedCornerShape(12.dp))
                ) {
                    val ratingRow: @Composable () -> Unit = {
                        Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                            (1..5).forEach { score ->
                                RatingCircle(score, selected = scores[name] == score, enabled = editable) { scores[name] = score }
                            }
                        }
                    }
                    val noteField: @Composable (Modifier) -> Unit = { fieldModifier ->
                        OutlinedTextField(
                            value = notes[name].orEmpty(),
                            onValueChange = { notes[name] = it.take(1000) },
                            placeholder = { Text("Observation (optional)", fontSize = 14.sp) },
                            readOnly = !editable,
                            singleLine = true,
                            shape = RoundedCornerShape(10.dp),
                            textStyle = MaterialTheme.typography.bodyMedium.copy(fontSize = 14.sp),
                            trailingIcon = if (editable) ({
                                VoiceMicButton(notes[name].orEmpty(), { notes[name] = it.take(1000) }, "Speak observation for $name", singleLine = true)
                            }) else null,
                            modifier = fieldModifier
                        )
                    }
                    if (isTablet) {
                        Row(Modifier.padding(horizontal = 12.dp, vertical = 4.dp), verticalAlignment = Alignment.CenterVertically) {
                            Text(name, fontSize = 15.sp, fontWeight = FontWeight.SemiBold, color = MaterialTheme.colorScheme.onSurface, modifier = Modifier.weight(0.3f))
                            ratingRow()
                            Spacer(Modifier.width(10.dp))
                            noteField(Modifier.weight(0.45f))
                        }
                    } else {
                        Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            Text(name, fontSize = 15.sp, fontWeight = FontWeight.SemiBold, color = MaterialTheme.colorScheme.onSurface)
                            ratingRow()
                            noteField(Modifier.fillMaxWidth())
                        }
                    }
                }
            }
            item {
                if (isTablet) {
                    Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        AssessmentTextArea(strengths, { strengths = it }, "Strengths", "Strength shown: ...\nEvidence from this assessment: ...", editable, Modifier.weight(1f))
                        AssessmentTextArea(focusAreas, { focusAreas = it }, "Focus areas", "Skill to develop: ...\nSuggested next step: ...", editable, Modifier.weight(1f))
                    }
                } else {
                    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                        AssessmentTextArea(strengths, { strengths = it }, "Strengths", "Strength shown: ...\nEvidence from this assessment: ...", editable, Modifier.fillMaxWidth())
                        AssessmentTextArea(focusAreas, { focusAreas = it }, "Focus areas", "Skill to develop: ...\nSuggested next step: ...", editable, Modifier.fillMaxWidth())
                    }
                }
            }
            item {
                val coachFeedbackField: @Composable (Modifier) -> Unit = { fieldModifier ->
                    AssessmentTextArea(
                        coachFeedback, { coachFeedback = it }, "Feedback for player",
                        "What you did well: ...\nWhat to focus on next: ...\nTry this in training: ...",
                        editable, fieldModifier
                    )
                }
                val playerFeedbackField: @Composable (Modifier) -> Unit = { fieldModifier ->
                    AssessmentTextArea(
                        playerFeedback, { playerFeedback = it }, "Player's thoughts or feedback",
                        "What felt good during this assessment?\nWhat would you like to improve or ask about?",
                        editable, fieldModifier
                    )
                }
                if (isTablet) {
                    Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        coachFeedbackField(Modifier.weight(1f))
                        playerFeedbackField(Modifier.weight(1f))
                    }
                } else {
                    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                        coachFeedbackField(Modifier.fillMaxWidth())
                        playerFeedbackField(Modifier.fillMaxWidth())
                    }
                }
            }
            if (videoCard != null) item { videoCard() }
            if (completed && assessment.aiSummary != null) {
                item {
                    Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.primary.copy(alpha = 0.08f))) {
                        Column(Modifier.fillMaxWidth().padding(14.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Icon(Icons.Outlined.AutoAwesome, contentDescription = null, tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(18.dp))
                                Text("  Development insights", fontWeight = FontWeight.Bold, fontSize = 16.sp, color = MaterialTheme.colorScheme.primary)
                            }
                            Text(assessment.aiSummary, fontSize = 14.sp, color = MaterialTheme.colorScheme.onSurface)
                            assessment.aiRecommendations.forEachIndexed { index, recommendation ->
                                Text("${index + 1}. $recommendation", fontSize = 14.sp, color = MaterialTheme.colorScheme.onSurface, modifier = Modifier.padding(top = 2.dp))
                            }
                        }
                    }
                }
            }
            item {
                if (error.isNotBlank()) Text(error, color = MaterialTheme.colorScheme.error, fontSize = 14.sp)
                if (!completed && !canComplete) {
                    Text(
                        "Rate every metric and add feedback for the player to complete the assessment.",
                        fontSize = 13.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
                HorizontalDivider(color = MaterialTheme.colorScheme.primary.copy(alpha = 0.3f), modifier = Modifier.padding(vertical = 6.dp))
                Row(
                    Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()),
                    horizontalArrangement = Arrangement.spacedBy(8.dp, Alignment.End),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    if (isSaving || isGeneratingInsights) CircularProgressIndicator(Modifier.size(20.dp), strokeWidth = 2.dp)
                    if (completed) {
                        OutlinedButton(onClick = onGenerateInsights, enabled = !isGeneratingInsights, shape = RoundedCornerShape(14.dp)) {
                            Icon(Icons.Outlined.AutoAwesome, contentDescription = null, modifier = Modifier.size(18.dp))
                            Text(if (assessment.aiSummary == null) "  Generate insights" else "  Regenerate insights")
                        }
                        OutlinedButton(onClick = onShareReport, shape = RoundedCornerShape(14.dp)) {
                            Icon(Icons.Outlined.Share, contentDescription = null, modifier = Modifier.size(18.dp))
                            Text("  Share")
                        }
                        Button(onClick = onDownloadReport, shape = RoundedCornerShape(14.dp)) {
                            Icon(Icons.Outlined.Download, contentDescription = null, modifier = Modifier.size(18.dp))
                            Text("  Download report")
                        }
                    } else {
                        OutlinedButton(
                            onClick = { onSave(currentMetrics(), strengths.trim(), focusAreas.trim(), coachFeedback.trim(), playerFeedback.trim(), false) },
                            enabled = !isSaving,
                            shape = RoundedCornerShape(14.dp)
                        ) {
                            Icon(Icons.Outlined.Save, contentDescription = null, modifier = Modifier.size(18.dp))
                            Text("  Save progress")
                        }
                        Button(
                            onClick = { onSave(currentMetrics(), strengths.trim(), focusAreas.trim(), coachFeedback.trim(), playerFeedback.trim(), true) },
                            enabled = !isSaving && canComplete,
                            shape = RoundedCornerShape(14.dp)
                        ) {
                            Icon(Icons.Outlined.CheckCircle, contentDescription = null, modifier = Modifier.size(18.dp))
                            Text("  Complete assessment")
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun RatingCircle(score: Int, selected: Boolean, enabled: Boolean, onClick: () -> Unit) {
    val primary = MaterialTheme.colorScheme.primary
    Box(
        Modifier
            .size(32.dp)
            .clip(CircleShape)
            .background(if (selected) primary else Color.Transparent)
            .border(1.dp, if (selected) primary else MaterialTheme.colorScheme.outline.copy(alpha = 0.6f), CircleShape)
            .clickable(enabled = enabled, onClick = onClick),
        contentAlignment = Alignment.Center
    ) {
        Text(
            score.toString(),
            fontSize = 15.sp,
            fontWeight = if (selected) FontWeight.Bold else FontWeight.Normal,
            color = if (selected) MaterialTheme.colorScheme.onPrimary else MaterialTheme.colorScheme.onSurface
        )
    }
}

@Composable
private fun AssessmentTextArea(
    value: String,
    onValueChange: (String) -> Unit,
    label: String,
    placeholder: String,
    editable: Boolean,
    modifier: Modifier = Modifier
) {
    Column(modifier, verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Text(label, fontSize = 15.sp, fontWeight = FontWeight.SemiBold, color = MaterialTheme.colorScheme.onSurface)
        OutlinedTextField(
            value = value,
            onValueChange = { onValueChange(it.take(4000)) },
            placeholder = { Text(placeholder, fontSize = 14.sp) },
            readOnly = !editable,
            minLines = 3,
            shape = RoundedCornerShape(12.dp),
            textStyle = MaterialTheme.typography.bodyMedium.copy(fontSize = 15.sp),
            trailingIcon = if (editable) ({
                VoiceMicButton(value, { onValueChange(it.take(4000)) }, "Speak $label")
            }) else null,
            modifier = Modifier.fillMaxWidth()
        )
    }
}

private fun isIsoDate(value: String): Boolean =
    runCatching { LocalDate.parse(value).toString() == value }.getOrDefault(false)
