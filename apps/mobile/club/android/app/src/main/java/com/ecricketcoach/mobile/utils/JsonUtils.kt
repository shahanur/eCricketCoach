package com.ecricketcoach.mobile.utils

import org.json.JSONArray
import org.json.JSONObject

/** Serialises JSON with sorted object keys so equivalent payloads compare equal. */
internal fun canonicalJson(value: String?): String {
    if (value == null || value == "null" || value.isBlank()) return "null"
    return runCatching { canonicalValue(JSONObject(value)) }
        .recoverCatching { canonicalValue(JSONArray(value)) }
        .getOrElse { value }
}

private fun canonicalValue(value: Any?): String = when (value) {
    is JSONObject -> {
        val keys = value.keys().asSequence().toList().sorted()
        keys.joinToString(prefix = "{", postfix = "}") { key ->
            "${JSONObject.quote(key)}:${canonicalValue(value.get(key))}"
        }
    }
    is JSONArray -> (0 until value.length()).joinToString(prefix = "[", postfix = "]") { index ->
        canonicalValue(value.get(index))
    }
    JSONObject.NULL -> "null"
    is String -> JSONObject.quote(value)
    else -> value.toString()
}
