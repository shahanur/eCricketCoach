package com.ecricketcoach.mobile

import android.content.Context
import android.util.Log
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import org.json.JSONArray
import org.json.JSONObject

data class CoachUser(
    val id: String,
    val name: String,
    val email: String,
    val role: String,
    val coachContext: String?,
    val tenantId: String?,
    val clubName: String?
)

data class Drill(
    val id: String,
    val title: String,
    val discipline: String,
    val skillSet: String,
    val durationMinutes: Int,
    val instructions: String
)

data class TrainingTemplate(
    val id: String,
    val title: String,
    val focus: String,
    val durationMinutes: Int,
    val disciplines: List<String>
)

class AuthStore(context: Context) {
    private val preferences = EncryptedSharedPreferences.create(
        context,
        "ecricketcoach_secure",
        MasterKey.Builder(context).setKeyScheme(MasterKey.KeyScheme.AES256_GCM).build(),
        EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
        EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
    )

    fun readToken(): String? = preferences.getString(KEY_TOKEN, null)

    fun readUser(): CoachUser? {
        val raw = preferences.getString(KEY_USER, null) ?: return null
        return runCatching {
            val user = JSONObject(raw)
            CoachUser(
                id = user.getString("id"),
                name = user.getString("name"),
                email = user.getString("email"),
                role = user.getString("role"),
                coachContext = user.optString("coachContext").takeIf(String::isNotBlank),
                tenantId = user.optString("tenantId").takeIf(String::isNotBlank),
                clubName = user.optString("clubName").takeIf(String::isNotBlank)
            )
        }.onFailure { Log.w(TAG, "Unable to read cached account data.", it) }.getOrNull()
    }

    fun saveSession(token: String, user: CoachUser) {
        val value = JSONObject()
            .put("id", user.id)
            .put("name", user.name)
            .put("email", user.email)
            .put("role", user.role)
            .put("coachContext", user.coachContext)
            .put("tenantId", user.tenantId)
            .put("clubName", user.clubName)
        preferences.edit()
            .putString(KEY_TOKEN, token)
            .putString(KEY_USER, value.toString())
            .apply()
    }

    fun readDrills(ownerId: String?): List<Drill> {
        if (preferences.getString(KEY_CACHE_OWNER, null) != ownerId) return emptyList()
        return readList(KEY_DRILLS) { row ->
            Drill(
                id = row.getString("id"),
                title = row.optString("title", "Untitled drill"),
                discipline = row.optString("discipline", "GENERAL"),
                skillSet = row.optString("skillSet", ""),
                durationMinutes = row.optInt("durationMinutes", row.optInt("duration", 0)),
                instructions = row.optString("instructions", "")
            )
        }
    }

    fun saveDrills(ownerId: String, drills: List<Drill>) {
        preferences.edit().putString(KEY_CACHE_OWNER, ownerId).apply()
        saveList(KEY_DRILLS, drills.map { drill ->
            JSONObject()
                .put("id", drill.id)
                .put("title", drill.title)
                .put("discipline", drill.discipline)
                .put("skillSet", drill.skillSet)
                .put("durationMinutes", drill.durationMinutes)
                .put("instructions", drill.instructions)
        })
    }

    fun readTemplates(ownerId: String?): List<TrainingTemplate> {
        if (preferences.getString(KEY_CACHE_OWNER, null) != ownerId) return emptyList()
        return readList(KEY_TEMPLATES) { row ->
            val disciplines = row.optJSONArray("disciplines") ?: JSONArray()
            TrainingTemplate(
                id = row.getString("id"),
                title = row.optString("title", "Training template"),
                focus = row.optString("focus", ""),
                durationMinutes = row.optInt("durationMinutes"),
                disciplines = (0 until disciplines.length()).map(disciplines::getString)
            )
        }
    }

    fun saveTemplates(ownerId: String, templates: List<TrainingTemplate>) {
        preferences.edit().putString(KEY_CACHE_OWNER, ownerId).apply()
        saveList(
            KEY_TEMPLATES,
            templates.map { template ->
                JSONObject()
                    .put("id", template.id)
                    .put("title", template.title)
                    .put("focus", template.focus)
                    .put("durationMinutes", template.durationMinutes)
                    .put("disciplines", JSONArray(template.disciplines))
            }
        )
    }

    fun clearSession() {
        preferences.edit().remove(KEY_TOKEN).remove(KEY_USER).apply()
    }

    private inline fun <T> readList(key: String, parse: (JSONObject) -> T): List<T> {
        val raw = preferences.getString(key, null) ?: return emptyList()
        return runCatching {
            val array = JSONArray(raw)
            (0 until array.length()).map { index -> parse(array.getJSONObject(index)) }
        }.onFailure { Log.w(TAG, "Unable to read cached training data.", it) }
            .getOrElse { emptyList() }
    }

    private fun saveList(key: String, rows: List<JSONObject>) {
        preferences.edit().putString(key, JSONArray(rows).toString()).apply()
    }

    private companion object {
        const val TAG = "eCricketCoach"
        const val KEY_TOKEN = "auth_token"
        const val KEY_USER = "current_user"
        const val KEY_DRILLS = "cached_drills"
        const val KEY_TEMPLATES = "cached_templates"
        const val KEY_CACHE_OWNER = "cached_training_owner"
    }
}
