package com.ecricketcoach.mobile.utils

import com.ecricketcoach.mobile.domain.model.ClubMember
import com.ecricketcoach.mobile.domain.model.ClubSquad
import com.ecricketcoach.mobile.domain.model.ClubTrainingSession
import org.json.JSONArray
import org.json.JSONObject

/** Builds the minimal update payload for an edited session plan. */
internal fun sessionPlanUpdates(
    session: ClubTrainingSession,
    title: String,
    date: String,
    duration: Int,
    squad: ClubSquad?,
    safety: List<String>,
    coach: ClubMember? = null,
    time: String? = null
): JSONObject {
    val updates = JSONObject()
        .put("title", title)
        .put("sessionDate", date)
        .put("durationMinutes", duration)
        .put("safety", JSONArray(safety))
    if (time != null) updates.put("sessionTime", time.ifBlank { null } ?: JSONObject.NULL)
    if (squad?.id != session.squadId) {
        updates.put("squadId", squad?.id ?: JSONObject.NULL)
            .put("squadName", squad?.name ?: "All players")
            .put("assignedPlayerIds", JSONArray())
    }
    if (coach != null && coach.id != session.coachId) {
        updates.put("coachId", coach.id)
            .put("coachName", coach.name)
    }
    return updates
}
