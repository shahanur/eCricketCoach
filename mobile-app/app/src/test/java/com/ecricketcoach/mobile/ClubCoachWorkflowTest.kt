package com.ecricketcoach.mobile

import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class ClubCoachWorkflowTest {
    @Test
    fun reportCsvQuotesCellsAndEscapesEmbeddedQuotes() {
        val csv = clubReportCsv(
            listOf(
                ClubReportRow(
                    sessionTitle = "Power, pace",
                    sessionDate = "2026-10-09",
                    squad = "U15 \"A\"",
                    durationMinutes = 75,
                    delivered = true,
                    playerName = "Sam",
                    playerLevel = "DEVELOPING",
                    attendance = "PRESENT",
                    hasPlayerNote = true
                )
            )
        )

        assertTrue(csv.startsWith("\uFEFF"))
        assertTrue(csv.contains("\"Power, pace\""))
        assertTrue(csv.contains("\"U15 \"\"A\"\"\""))
        assertTrue(csv.endsWith("\"Yes\""))
    }

    @Test
    fun reportRowsUseOnlySelectedSessionsAndAssignedPlayers() {
        val player = ClubMember("p1", "Asha", "", "PLAYER", "U15", "BATTING", "ACTIVE", "DEVELOPING", "U15")
        val other = ClubMember("p2", "Lee", "", "PLAYER", "U15", "BOWLING", "ACTIVE", "FOUNDATION", "U15")
        val coach = ClubMember("c1", "Coach", "", "COACH", "", "BATTING", "ACTIVE", "", "U15")
        val session = ClubTrainingSession(
            id = "s1",
            title = "Net practice",
            squadId = "q1",
            squadName = "U15",
            sessionDate = "2026-10-09",
            durationMinutes = 60,
            isPublished = true,
            isExecuted = true,
            drillCount = 1,
            postNotes = "",
            coachId = "c1",
            assignedPlayerIds = listOf("p1"),
            safety = emptyList(),
            drillIds = listOf("d1"),
            playerNotes = JSONObject().put("p1", true),
            executionLog = JSONObject().put("attendance", JSONObject().put("p1", "LATE"))
        )

        val rows = clubReportRows(
            listOf(player, other, coach),
            listOf(session),
            fromDate = "2026-10-09",
            throughDate = "2026-10-09",
            squadFilter = "U15"
        )

        assertEquals(1, rows.size)
        assertEquals("Asha", rows.single().playerName)
        assertEquals("LATE", rows.single().attendance)
        assertTrue(rows.single().hasPlayerNote)

        val squad = ClubSquad("q1", "U15", "U15", listOf("BATTING"), 1)
        val unchangedTarget = sessionPlanUpdates(session, "Updated", "2026-10-10", 75, squad, listOf("Check nets"))
        assertEquals("Updated", unchangedTarget.getString("title"))
        assertEquals("2026-10-10", unchangedTarget.getString("sessionDate"))
        assertEquals(75, unchangedTarget.getInt("durationMinutes"))
        assertEquals("Check nets", unchangedTarget.getJSONArray("safety").getString(0))
        assertFalse(unchangedTarget.has("squadId"))
        assertFalse(unchangedTarget.has("assignedPlayerIds"))
        assertFalse(unchangedTarget.has("coachId"))
        assertFalse(unchangedTarget.has("drillIds"))
        assertFalse(unchangedTarget.has("executionLog"))
        assertFalse(unchangedTarget.has("isExecuted"))

        val allPlayers = sessionPlanUpdates(session, session.title, session.sessionDate, 60, null, emptyList())
        assertTrue(allPlayers.isNull("squadId"))
        assertEquals("All players", allPlayers.getString("squadName"))
        assertEquals(0, allPlayers.getJSONArray("assignedPlayerIds").length())
    }

    @Test
    fun offlineJournalDeduplicatesByOperationIdAndIsolatesAccountAndTenant() {
        val first = OfflineMutation(
            id = "operation-1",
            userId = "coach-1",
            tenantId = "club-1",
            kind = OfflineMutation.UPDATE_MEMBER_SQUAD,
            resourceId = "player-1",
            payload = """{"squad":"U15"}""",
            baseValue = "Unassigned"
        )
        val sameId = first.copy(payload = """{"squad":"U16"}""")
        val differentTenant = first.copy(id = "operation-2", tenantId = "club-2")

        val rows = OfflineMutationJournal.enqueue(
            OfflineMutationJournal.enqueue(listOf(first), sameId),
            differentTenant
        )

        assertEquals(2, rows.size)
        assertEquals(listOf(first), OfflineMutationJournal.scoped(rows, "coach-1", "club-1"))
        assertEquals(listOf(differentTenant), OfflineMutationJournal.scoped(rows, "coach-1", "club-2"))
        assertEquals("operation-1", OfflineMutation.fromJson(first.toJson()).id)
    }

    @Test
    fun canonicalJsonComparesEquivalentObjectKeyOrder() {
        assertEquals(
            canonicalJson("""{"executionLog":{"status":"IN_PROGRESS","checklist":{"plan":true}}}"""),
            canonicalJson("""{"executionLog":{"checklist":{"plan":true},"status":"IN_PROGRESS"}}""")
        )
        assertFalse(canonicalJson("""{"status":"IN_PROGRESS"}""") == canonicalJson("""{"status":"COMPLETED"}"""))
    }
}
