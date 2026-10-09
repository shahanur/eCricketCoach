package com.ecricketcoach.mobile

import android.content.Context
import android.content.Intent
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.RectF
import android.graphics.Typeface
import android.graphics.pdf.PdfDocument
import android.util.Base64
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material.icons.outlined.Download
import androidx.compose.material.icons.outlined.Share
import androidx.compose.material3.Button
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.FileProvider
import java.io.File
import java.io.FileOutputStream
import java.time.LocalDate

data class ClubReportRow(
    val sessionTitle: String,
    val sessionDate: String,
    val squad: String,
    val durationMinutes: Int,
    val delivered: Boolean,
    val playerName: String,
    val playerLevel: String,
    val attendance: String,
    val hasPlayerNote: Boolean
)

fun clubReportRows(
    members: List<ClubMember>,
    sessions: List<ClubTrainingSession>,
    fromDate: String,
    throughDate: String,
    squadFilter: String
): List<ClubReportRow> {
    val selectedSessions = sessions.filter { session ->
        (fromDate.isBlank() || session.sessionDate >= fromDate) &&
            (throughDate.isBlank() || session.sessionDate <= throughDate) &&
            (squadFilter.isBlank() || session.squadName.contains(squadFilter, ignoreCase = true))
    }.sortedByDescending(ClubTrainingSession::sessionDate)
    val players = members.filter { it.role == "PLAYER" && it.invitationStatus == "ACTIVE" }
    return selectedSessions.flatMap { session ->
        val assignedIds = session.assignedPlayerIds.toSet()
        val participants = players.filter { player ->
            if (assignedIds.isNotEmpty()) player.id in assignedIds else player.squad == session.squadName
        }
        if (participants.isEmpty()) {
            listOf(ClubReportRow(
                session.title, session.sessionDate, session.squadName, session.durationMinutes,
                session.isExecuted, "", "", "No participant roster", false
            ))
        } else participants.map { player ->
            val attendance = session.executionLog?.optJSONObject("attendance")?.optString(player.id).orEmpty()
            ClubReportRow(
                session.title,
                session.sessionDate,
                session.squadName,
                session.durationMinutes,
                session.isExecuted,
                player.name,
                player.currentLevel,
                attendance.takeIf { it in setOf("PRESENT", "LATE", "ABSENT") } ?: "Unrecorded",
                session.playerNotes.optString(player.id).isNotBlank()
            )
        }
    }
}

fun clubReportCsv(rows: List<ClubReportRow>): String {
    val header = listOf(
        "Session", "Date", "Squad", "Duration minutes", "Session status", "Participant",
        "Player level", "Attendance", "Participant note recorded"
    )
    val lines = listOf(header) + rows.map { row ->
        listOf(
            row.sessionTitle,
            row.sessionDate,
            row.squad,
            row.durationMinutes.toString(),
            if (row.delivered) "Delivered" else "Scheduled",
            row.playerName,
            row.playerLevel,
            row.attendance,
            if (row.hasPlayerNote) "Yes" else "No"
        )
    }
    return "\uFEFF" + lines.joinToString("\r\n") { columns ->
        columns.joinToString(",") { "\"${it.replace("\"", "\"\"")}\"" }
    }
}

private fun exportDirectory(context: Context): File =
    File(context.cacheDir, "club-exports").apply { mkdirs() }

fun exportClubReportPdf(context: Context, clubName: String, rows: List<ClubReportRow>): File {
    val document = PdfDocument()
    val body = Paint(Paint.ANTI_ALIAS_FLAG).apply { textSize = 10f }
    val heading = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        textSize = 17f
        typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
    }
    val smallHeading = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        textSize = 10f
        typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
    }
    val columns = listOf("Date", "Session / squad", "Participant", "Attendance", "Activity")
    val rowHeight = 22f
    var pageNumber = 1
    var page = document.startPage(PdfDocument.PageInfo.Builder(842, 595, pageNumber).create())
    var canvas = page.canvas
    fun drawHeader(target: Canvas) {
        target.drawText("Club Session & Participant Report", 36f, 42f, heading)
        target.drawText("$clubName · Generated ${LocalDate.now()}", 36f, 61f, body)
        val x = floatArrayOf(36f, 118f, 400f, 610f, 700f)
        columns.forEachIndexed { index, title -> target.drawText(title, x[index], 90f, smallHeading) }
    }
    drawHeader(canvas)
    var y = 112f
    rows.forEach { row ->
        if (y > 550f) {
            document.finishPage(page)
            pageNumber += 1
            page = document.startPage(PdfDocument.PageInfo.Builder(842, 595, pageNumber).create())
            canvas = page.canvas
            drawHeader(canvas)
            y = 112f
        }
        val values = listOf(
            row.sessionDate,
            "${row.sessionTitle} / ${row.squad}",
            if (row.playerName.isBlank()) "—" else "${row.playerName} (${row.playerLevel})",
            row.attendance,
            if (row.hasPlayerNote) "Note recorded" else "No note"
        )
        val x = floatArrayOf(36f, 118f, 400f, 610f, 700f)
        values.forEachIndexed { index, value ->
            canvas.drawText(value.take(43), x[index], y, body)
        }
        canvas.drawLine(36f, y + 6f, 806f, y + 6f, body)
        y += rowHeight
    }
    document.finishPage(page)
    val file = File(exportDirectory(context), "club-session-report-${LocalDate.now()}.pdf")
    FileOutputStream(file).use(document::writeTo)
    document.close()
    return file
}

/**
 * A single labelled section of a session report. When [tableHeaders] is set, [tableRows] is
 * rendered as a striped table (matching the web app's session report design); otherwise [lines]
 * is rendered as wrapped paragraphs.
 */
data class SessionReportSection(
    val heading: String,
    val lines: List<String> = emptyList(),
    val tableHeaders: List<String>? = null,
    val tableRows: List<List<String>>? = null,
    val columnWeights: List<Float>? = null
)

private fun wrapLine(paint: Paint, text: String, maxWidth: Float): List<String> {
    if (text.isBlank()) return listOf("")
    val words = text.split(Regex("\\s+"))
    val lines = mutableListOf<String>()
    var current = StringBuilder()
    words.forEach { word ->
        val candidate = if (current.isEmpty()) word else "$current $word"
        if (paint.measureText(candidate) > maxWidth && current.isNotEmpty()) {
            lines += current.toString()
            current = StringBuilder(word)
        } else {
            current = StringBuilder(candidate)
        }
    }
    if (current.isNotEmpty()) lines += current.toString()
    return lines
}

private val ReportGreen = android.graphics.Color.rgb(4, 120, 87)
private val ReportRowAlt = android.graphics.Color.rgb(243, 244, 246)
private val ReportTextDark = android.graphics.Color.rgb(31, 41, 55)
private val ReportTextLabel = android.graphics.Color.rgb(55, 65, 81)
private val ReportTextGray = android.graphics.Color.rgb(107, 114, 128)

private fun reportTimestamp(): String =
    java.time.format.DateTimeFormatter.ofPattern("dd/MM/yyyy, HH:mm:ss")
        .format(java.time.LocalDateTime.now())

/** Builds a full session summary PDF (facts, drills, incidents, notes, evaluation and AI analysis). */
fun exportSessionReportPdf(
    context: Context,
    title: String,
    subtitle: String,
    facts: List<Pair<String, String>>,
    sections: List<SessionReportSection>
): File {
    val pageCount = renderSessionReportPdf(title, subtitle, facts, sections, totalPages = null).let { (document, pages) ->
        document.close()
        pages
    }
    val (document, _) = renderSessionReportPdf(title, subtitle, facts, sections, totalPages = pageCount)
    val safeName = title.replace(Regex("[^A-Za-z0-9]+"), "-").trim('-').ifBlank { "session-report" }
    val file = File(exportDirectory(context), "$safeName-${LocalDate.now()}.pdf")
    FileOutputStream(file).use(document::writeTo)
    document.close()
    return file
}

/** Lays out the session report once; pass [totalPages] on the second pass to print "Page X of Y" footers. */
private fun renderSessionReportPdf(
    title: String,
    subtitle: String,
    facts: List<Pair<String, String>>,
    sections: List<SessionReportSection>,
    totalPages: Int?
): Pair<PdfDocument, Int> {
    val document = PdfDocument()
    val pageWidth = 595
    val pageHeight = 842
    val marginX = 40f
    val contentWidth = pageWidth - marginX * 2
    val bannerHeight = 72f
    val bottomLimit = pageHeight - 46f
    val generatedAt = reportTimestamp()

    val bannerPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = ReportGreen; style = Paint.Style.FILL }
    val bannerTitlePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = android.graphics.Color.WHITE
        textSize = 20f
        typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
    }
    val bannerSubtitlePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = android.graphics.Color.argb(235, 255, 255, 255)
        textSize = 12f
    }
    val labelPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = ReportTextLabel
        textSize = 11f
        typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
    }
    val valuePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = ReportTextDark; textSize = 11f }
    val sectionHeadingPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = ReportGreen
        textSize = 13f
        typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
    }
    val sectionRulePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = ReportGreen; strokeWidth = 1.2f }
    val tableHeaderBgPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = ReportGreen; style = Paint.Style.FILL }
    val tableHeaderTextPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = android.graphics.Color.WHITE
        textSize = 10f
        typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
    }
    val tableRowAltPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = ReportRowAlt; style = Paint.Style.FILL }
    val tableCellPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = ReportTextDark; textSize = 10f }
    val bodyPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = ReportTextDark; textSize = 11f }
    val footerPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = ReportTextGray; textSize = 9f }

    var pageNumber = 1
    var page = document.startPage(PdfDocument.PageInfo.Builder(pageWidth, pageHeight, pageNumber).create())
    var canvas = page.canvas
    var y: Float

    fun drawBanner() {
        canvas.drawRect(0f, 0f, pageWidth.toFloat(), bannerHeight, bannerPaint)
        canvas.drawText(title, marginX, 32f, bannerTitlePaint)
        canvas.drawText(subtitle, marginX, 54f, bannerSubtitlePaint)
    }

    fun drawFooter() {
        val footerY = pageHeight - 22f
        canvas.drawText("Generated $generatedAt - eCricketCoach", marginX, footerY, footerPaint)
        val pageLabel = if (totalPages != null) "Page $pageNumber of $totalPages" else "Page $pageNumber"
        val w = footerPaint.measureText(pageLabel)
        canvas.drawText(pageLabel, pageWidth - marginX - w, footerY, footerPaint)
    }

    drawBanner()
    y = bannerHeight + 28f

    fun newPage() {
        drawFooter()
        document.finishPage(page)
        pageNumber += 1
        page = document.startPage(PdfDocument.PageInfo.Builder(pageWidth, pageHeight, pageNumber).create())
        canvas = page.canvas
        y = 50f
    }

    fun ensureSpace(nextHeight: Float): Boolean {
        if (y + nextHeight > bottomLimit) {
            newPage()
            return true
        }
        return false
    }

    val factLabelWidth = 150f
    facts.forEach { (label, value) ->
        ensureSpace(17f)
        canvas.drawText(label, marginX, y, labelPaint)
        wrapLine(valuePaint, value, contentWidth - factLabelWidth).let { wrapped ->
            canvas.drawText(wrapped.firstOrNull().orEmpty(), marginX + factLabelWidth, y, valuePaint)
        }
        y += 17f
    }

    fun drawSectionHeading(text: String) {
        ensureSpace(32f)
        y += 12f
        canvas.drawText(text, marginX, y, sectionHeadingPaint)
        y += 6f
        canvas.drawLine(marginX, y, marginX + contentWidth, y, sectionRulePaint)
        y += 16f
    }

    fun drawTable(headers: List<String>, rows: List<List<String>>, weights: List<Float>?) {
        val resolvedWeights = weights ?: List(headers.size) { 1f / headers.size }
        val colWidths = resolvedWeights.map { it * contentWidth }
        val colX = mutableListOf(marginX)
        for (i in 1 until colWidths.size) colX += colX[i - 1] + colWidths[i - 1]
        val headerRowHeight = 20f

        fun drawHeaderRow() {
            canvas.drawRect(marginX, y, marginX + contentWidth, y + headerRowHeight, tableHeaderBgPaint)
            headers.forEachIndexed { i, h -> canvas.drawText(h, colX[i] + 6f, y + 14f, tableHeaderTextPaint) }
            y += headerRowHeight
        }

        ensureSpace(headerRowHeight)
        drawHeaderRow()
        if (rows.isEmpty()) {
            ensureSpace(16f)
            canvas.drawText("—", colX[0] + 6f, y + 11f, tableCellPaint)
            y += 16f
            return
        }
        rows.forEachIndexed { rowIndex, row ->
            val wrappedCells = row.mapIndexed { i, cell -> wrapLine(tableCellPaint, cell, (colWidths.getOrElse(i) { contentWidth }) - 12f) }
            val lineCount = (wrappedCells.maxOfOrNull { it.size } ?: 1).coerceAtLeast(1)
            val rowHeight = lineCount * 13f + 8f
            val broke = ensureSpace(rowHeight)
            if (broke) drawHeaderRow()
            if (rowIndex % 2 == 1) canvas.drawRect(marginX, y, marginX + contentWidth, y + rowHeight, tableRowAltPaint)
            wrappedCells.forEachIndexed { i, lines ->
                lines.forEachIndexed { li, line -> canvas.drawText(line, colX[i] + 6f, y + 12f + li * 13f, tableCellPaint) }
            }
            y += rowHeight
        }
        y += 10f
    }

    sections.forEach { section ->
        drawSectionHeading(section.heading)
        if (section.tableHeaders != null) {
            drawTable(section.tableHeaders, section.tableRows.orEmpty(), section.columnWeights)
        } else if (section.lines.isEmpty()) {
            ensureSpace(15f)
            canvas.drawText("-  None", marginX, y, bodyPaint)
            y += 15f
        } else {
            section.lines.forEach { line ->
                val separatorIndex = line.indexOf(": ")
                if (separatorIndex > 0 && separatorIndex < 40) {
                    val name = line.substring(0, separatorIndex)
                    val rest = line.substring(separatorIndex + 2)
                    ensureSpace(15f)
                    canvas.drawText(name, marginX, y, labelPaint)
                    y += 14f
                    wrapLine(bodyPaint, rest, contentWidth).forEach { wrapped ->
                        ensureSpace(15f)
                        canvas.drawText(wrapped, marginX, y, bodyPaint)
                        y += 15f
                    }
                } else {
                    wrapLine(bodyPaint, line, contentWidth).forEach { wrapped ->
                        ensureSpace(15f)
                        canvas.drawText(wrapped, marginX, y, bodyPaint)
                        y += 15f
                    }
                }
            }
        }
    }
    drawFooter()
    document.finishPage(page)
    return document to pageNumber
}

fun exportCertificatePdf(context: Context, certificate: ClubCertificate): File {
    val document = PdfDocument()
    val page = document.startPage(PdfDocument.PageInfo.Builder(842, 595, 1).create())
    val canvas = page.canvas
    val border = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = android.graphics.Color.rgb(177, 132, 53)
        style = Paint.Style.STROKE
        strokeWidth = 3f
    }
    canvas.drawColor(android.graphics.Color.rgb(248, 250, 252))
    canvas.drawRect(28f, 28f, 814f, 567f, border)
    val text = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = android.graphics.Color.rgb(35, 54, 71)
        textAlign = Paint.Align.CENTER
    }
    val clubName = certificate.clubName.ifBlank { "eCricketCoach" }
    val logoValue = certificate.clubLogo
    if (logoValue != null) {
        val payload = logoValue.substringAfter(',', "")
        val bitmap = runCatching {
            val bytes = Base64.decode(payload, Base64.DEFAULT)
            BitmapFactory.decodeByteArray(bytes, 0, bytes.size)
        }.getOrNull()
        if (bitmap != null) {
            val ratio = minOf(1f, 56f / bitmap.width, 56f / bitmap.height)
            val imageWidth = bitmap.width * ratio
            val imageHeight = bitmap.height * ratio
            canvas.drawBitmap(
                bitmap,
                null,
                RectF(393f - imageWidth, 54f, 393f, 54f + imageHeight),
                Paint(Paint.ANTI_ALIAS_FLAG).apply { isFilterBitmap = true }
            )
            text.textSize = 19f
            canvas.drawText(clubName, 490f, 89f, text)
            bitmap.recycle()
        } else {
            text.textSize = 20f
            canvas.drawText(clubName, 421f, 70f, text)
        }
    } else {
        text.textSize = 20f
        canvas.drawText(clubName, 421f, 70f, text)
    }
    text.color = android.graphics.Color.rgb(138, 100, 35)
    text.textSize = 16f
    canvas.drawText("CERTIFICATE OF ACHIEVEMENT", 421f, 132f, text)
    text.color = android.graphics.Color.rgb(75, 85, 99)
    text.textSize = 17f
    canvas.drawText("This certificate is proudly presented to", 421f, 188f, text)
    text.typeface = Typeface.create("serif", Typeface.BOLD)
    text.color = android.graphics.Color.rgb(20, 43, 60)
    text.textSize = 34f
    canvas.drawText(certificate.playerName.take(45), 421f, 236f, text)
    text.typeface = Typeface.DEFAULT
    text.color = android.graphics.Color.rgb(75, 85, 99)
    text.textSize = 17f
    canvas.drawText("for achieving", 421f, 278f, text)
    text.color = android.graphics.Color.rgb(25, 125, 93)
    text.typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
    text.textSize = 27f
    canvas.drawText(certificate.level, 421f, 320f, text)
    text.color = android.graphics.Color.rgb(55, 65, 81)
    text.textSize = 17f
    canvas.drawText(certificate.discipline, 421f, 351f, text)
    text.typeface = Typeface.DEFAULT
    text.textSize = 12f
    if (certificate.coachNotes.isNotBlank()) {
        canvas.drawText("Coach notes: ${certificate.coachNotes.take(90)}", 421f, 405f, text)
    }
    if (certificate.aiCommendation.isNotBlank()) {
        canvas.drawText("Commendation: ${certificate.aiCommendation.take(90)}", 421f, 429f, text)
    }
    text.typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
    text.textSize = 14f
    canvas.drawText(certificate.coachName, 421f, 481f, text)
    text.typeface = Typeface.DEFAULT
    text.textSize = 11f
    canvas.drawText("Coach", 421f, 499f, text)
    text.textAlign = Paint.Align.LEFT
    canvas.drawText("Issued ${certificate.issuedDate}", 48f, 540f, text)
    text.textAlign = Paint.Align.RIGHT
    canvas.drawText("Certificate No. ${certificate.number}", 794f, 540f, text)
    document.finishPage(page)
    val file = File(exportDirectory(context), "${safeFilePart(certificate.number)}-certificate.pdf")
    FileOutputStream(file).use(document::writeTo)
    document.close()
    return file
}

private fun safeFilePart(value: String): String =
    value.lowercase().replace(Regex("[^a-z0-9-]+"), "-").trim('-').ifBlank { "certificate" }

fun shareClubExport(context: Context, file: File, mimeType: String, title: String) {
    val uri = FileProvider.getUriForFile(context, "${context.packageName}.files", file)
    val send = Intent(Intent.ACTION_SEND).apply {
        type = mimeType
        putExtra(Intent.EXTRA_STREAM, uri)
        addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
    }
    context.startActivity(Intent.createChooser(send, title))
}

fun openClubExport(context: Context, file: File, mimeType: String, title: String) {
    val uri = FileProvider.getUriForFile(context, "${context.packageName}.files", file)
    val view = Intent(Intent.ACTION_VIEW).apply {
        setDataAndType(uri, mimeType)
        addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
    }
    context.startActivity(Intent.createChooser(view, title))
}

@Composable
internal fun ClubReportsPanel(
    clubName: String,
    members: List<ClubMember>,
    sessions: List<ClubTrainingSession>,
    loadError: String,
    modifier: Modifier = Modifier
) {
    val context = LocalContext.current
    var fromDate by remember { mutableStateOf("") }
    var throughDate by remember { mutableStateOf("") }
    var squad by remember { mutableStateOf("") }
    var error by remember { mutableStateOf("") }
    val validRange = (fromDate.isBlank() || runCatching { LocalDate.parse(fromDate) }.isSuccess) &&
        (throughDate.isBlank() || runCatching { LocalDate.parse(throughDate) }.isSuccess) &&
        (fromDate.isBlank() || throughDate.isBlank() || fromDate <= throughDate)
    val rows = remember(members, sessions, fromDate, throughDate, squad) {
        clubReportRows(members, sessions, fromDate, throughDate, squad.trim())
    }
    LazyColumn(modifier, verticalArrangement = Arrangement.spacedBy(8.dp)) {
        item {
            Text("Session reports", color = MaterialTheme.colorScheme.primary, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
            Text("Session delivery, assigned participants, attendance and recorded individual coaching notes.")
            if (loadError.isNotBlank()) Text(loadError, color = MaterialTheme.colorScheme.error)
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                OutlinedTextField(fromDate, { fromDate = it }, label = { Text("From (YYYY-MM-DD)") }, modifier = Modifier.weight(1f), singleLine = true)
                OutlinedTextField(throughDate, { throughDate = it }, label = { Text("Through") }, modifier = Modifier.weight(1f), singleLine = true)
            }
            OutlinedTextField(squad, { squad = it }, label = { Text("Filter squad") }, modifier = Modifier.fillMaxWidth(), singleLine = true)
            if (!validRange) Text("Enter valid dates and make sure the start date is not after the end date.", color = MaterialTheme.colorScheme.error)
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Button(enabled = rows.isNotEmpty() && validRange, onClick = {
                    error = runCatching {
                        shareClubExport(context, exportClubReportPdf(context, clubName, rows), "application/pdf", "Share PDF report")
                    }.exceptionOrNull()?.message.orEmpty()
                }) { Text("Share PDF") }
                TextButton(enabled = rows.isNotEmpty() && validRange, onClick = {
                    error = runCatching {
                        val file = File(exportDirectory(context), "club-session-report-${LocalDate.now()}.csv")
                        file.writeText(clubReportCsv(rows), Charsets.UTF_8)
                        shareClubExport(context, file, "text/csv", "Share CSV report")
                    }.exceptionOrNull()?.message.orEmpty()
                }) { Text("Share CSV") }
            }
            if (error.isNotBlank()) Text(error, color = MaterialTheme.colorScheme.error)
        }
        if (rows.isEmpty()) item { Text("No session activity matches these filters.") }
        items(rows, key = { "${it.sessionDate}:${it.sessionTitle}:${it.playerName}" }) { row ->
            Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)) {
                Column(Modifier.fillMaxWidth().padding(12.dp)) {
                    Text(row.sessionTitle, fontWeight = FontWeight.SemiBold)
                    Text("${row.sessionDate} · ${row.squad} · ${row.durationMinutes} min · ${if (row.delivered) "Delivered" else "Scheduled"}")
                    if (row.playerName.isNotBlank()) {
                        Text("${row.playerName} · ${row.playerLevel} · ${row.attendance}")
                        Text(if (row.hasPlayerNote) "Individual coach note recorded" else "No individual note recorded")
                    } else Text(row.attendance)
                }
            }
        }
    }
}

@Composable
internal fun DeliveredSessionsPanel(
    clubName: String,
    members: List<ClubMember>,
    sessions: List<ClubTrainingSession>,
    onBack: () -> Unit,
    modifier: Modifier = Modifier
) {
    val context = LocalContext.current
    var error by remember { mutableStateOf("") }
    val delivered = remember(sessions) {
        sessions.filter(ClubTrainingSession::isExecuted).sortedByDescending(ClubTrainingSession::sessionDate)
    }
    LazyColumn(modifier, verticalArrangement = Arrangement.spacedBy(10.dp)) {
        item {
            Row(verticalAlignment = Alignment.CenterVertically) {
                IconButton(onClick = onBack) {
                    Icon(Icons.AutoMirrored.Outlined.ArrowBack, contentDescription = "Back to overview")
                }
                Text("Delivered sessions", color = MaterialTheme.colorScheme.primary, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
            }
            Text("Download or share the session summary as a PDF.", style = MaterialTheme.typography.bodySmall)
            if (error.isNotBlank()) Text(error, color = MaterialTheme.colorScheme.error)
        }
        if (delivered.isEmpty()) item { Text("No sessions have been delivered yet.") }
        items(delivered, key = ClubTrainingSession::id) { session ->
            Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)) {
                Column(Modifier.fillMaxWidth().padding(14.dp)) {
                    Text(session.title, fontWeight = FontWeight.SemiBold)
                    Text("${session.sessionDate} · ${session.squadName} · ${session.durationMinutes} min", fontSize = 12.sp)
                    Row(horizontalArrangement = Arrangement.spacedBy(2.dp)) {
                        WorkspaceAction("Download PDF", Icons.Outlined.Download, {
                            error = runCatching {
                                val rows = clubReportRows(members, listOf(session), "", "", "")
                                openClubExport(context, exportClubReportPdf(context, clubName, rows), "application/pdf", "Open PDF report")
                            }.exceptionOrNull()?.message.orEmpty()
                        })
                        WorkspaceAction("Share PDF", Icons.Outlined.Share, {
                            error = runCatching {
                                val rows = clubReportRows(members, listOf(session), "", "", "")
                                shareClubExport(context, exportClubReportPdf(context, clubName, rows), "application/pdf", "Share PDF report")
                            }.exceptionOrNull()?.message.orEmpty()
                        })
                    }
                }
            }
        }
    }
}

@Composable
internal fun ParticipantsPanel(
    members: List<ClubMember>,
    onBack: () -> Unit,
    modifier: Modifier = Modifier
) {
    val players = remember(members) {
        members.filter { it.role == "PLAYER" && it.invitationStatus == "ACTIVE" }.sortedBy(ClubMember::name)
    }
    LazyColumn(modifier, verticalArrangement = Arrangement.spacedBy(10.dp)) {
        item {
            Row(verticalAlignment = Alignment.CenterVertically) {
                IconButton(onClick = onBack) {
                    Icon(Icons.AutoMirrored.Outlined.ArrowBack, contentDescription = "Back to overview")
                }
                Text("Active participants", color = MaterialTheme.colorScheme.primary, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
            }
        }
        if (players.isEmpty()) item { Text("No active players found for this club.") }
        items(players, key = ClubMember::id) { player ->
            Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)) {
                Column(Modifier.fillMaxWidth().padding(14.dp)) {
                    Text(player.name, fontWeight = FontWeight.SemiBold)
                    Text(player.email, fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.75f))
                    Text("${player.ageGroup.ifBlank { "No age group" }} · ${player.discipline} · ${player.currentLevel}", fontSize = 12.sp)
                    Text("Squad: ${player.squad}", fontSize = 12.sp)
                }
            }
        }
    }
}

@Composable
internal fun CertificatesPanel(
    certificates: List<ClubCertificate>,
    canDelete: Boolean,
    onDelete: (ClubCertificate) -> Unit,
    modifier: Modifier = Modifier
) {
    val context = LocalContext.current
    var query by remember { mutableStateOf("") }
    var discipline by remember { mutableStateOf("") }
    var issuedFrom by remember { mutableStateOf("") }
    var issuedThrough by remember { mutableStateOf("") }
    var error by remember { mutableStateOf("") }
    var deleteTarget by remember { mutableStateOf<ClubCertificate?>(null) }
    val filtered = certificates.filter { certificate ->
        (query.isBlank() || certificate.playerName.contains(query, true) || certificate.number.contains(query, true) ||
            certificate.level.contains(query, true)) &&
            (discipline.isBlank() || certificate.discipline.contains(discipline, true)) &&
            (issuedFrom.isBlank() || certificate.issuedDate >= issuedFrom) &&
            (issuedThrough.isBlank() || certificate.issuedDate <= issuedThrough)
    }
    LazyColumn(modifier, verticalArrangement = Arrangement.spacedBy(8.dp)) {
        item {
            Text("Certificates", color = MaterialTheme.colorScheme.primary, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
            OutlinedTextField(query, { query = it }, label = { Text("Filter player, level or number") }, modifier = Modifier.fillMaxWidth(), singleLine = true)
            OutlinedTextField(discipline, { discipline = it }, label = { Text("Filter discipline") }, modifier = Modifier.fillMaxWidth(), singleLine = true)
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                OutlinedTextField(issuedFrom, { issuedFrom = it }, label = { Text("Issued from") }, modifier = Modifier.weight(1f), singleLine = true)
                OutlinedTextField(issuedThrough, { issuedThrough = it }, label = { Text("Issued through") }, modifier = Modifier.weight(1f), singleLine = true)
            }
            Text("PDFs use the saved certificate fields and club branding.", style = MaterialTheme.typography.bodySmall)
            if (error.isNotBlank()) Text(error, color = MaterialTheme.colorScheme.error)
        }
        if (filtered.isEmpty()) item { Text("No certificates match these filters.") }
        items(filtered, key = ClubCertificate::id) { certificate ->
            Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)) {
                Column(Modifier.fillMaxWidth().padding(12.dp)) {
                    Text(certificate.playerName, fontWeight = FontWeight.SemiBold)
                    Text("${certificate.level} · ${certificate.discipline} · ${certificate.issuedDate}")
                    Text("${certificate.clubName} · No. ${certificate.number} · Coach ${certificate.coachName}")
                    if (certificate.coachNotes.isNotBlank()) Text("Coach notes: ${certificate.coachNotes}")
                    if (certificate.aiCommendation.isNotBlank()) Text("Commendation: ${certificate.aiCommendation}")
                    Row(horizontalArrangement = Arrangement.End, modifier = Modifier.fillMaxWidth()) {
                        TextButton(onClick = {
                            error = runCatching {
                                shareClubExport(context, exportCertificatePdf(context, certificate), "application/pdf", "Share certificate")
                            }.exceptionOrNull()?.message.orEmpty()
                        }) { Text("Download / share PDF") }
                        if (canDelete) TextButton(onClick = { deleteTarget = certificate }) { Text("Delete") }
                    }
                }
                deleteTarget?.let { certificate ->
                    AlertDialog(
                        onDismissRequest = { deleteTarget = null },
                        title = { Text("Delete certificate?") },
                        text = { Text("Permanently delete certificate ${certificate.number} for ${certificate.playerName}?") },
                        confirmButton = {
                            Button(onClick = {
                                deleteTarget = null
                                onDelete(certificate)
                            }) { Text("Delete certificate") }
                        },
                        dismissButton = { TextButton(onClick = { deleteTarget = null }) { Text("Cancel") } }
                    )
                }
            }
        }
    }
}
