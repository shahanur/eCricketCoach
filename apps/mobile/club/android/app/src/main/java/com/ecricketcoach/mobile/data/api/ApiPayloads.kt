package com.ecricketcoach.mobile.data.api

import com.ecricketcoach.mobile.domain.model.CapeInput
import com.ecricketcoach.mobile.domain.model.CapeManualFrames
import org.json.JSONArray
import org.json.JSONObject

internal fun CapeInput.calibrationArray(): JSONArray =
    JSONArray(calibrationPoints.map { (x, y) -> JSONArray().put(x).put(y) })

internal fun CapeInput.calibrationJson(): String = calibrationArray().toString()

internal fun CapeManualFrames.toJson(): JSONObject = JSONObject()
    .put("pre_contact", JSONArray(preContact))
    .put("point_of_contact", JSONArray(pointOfContact))
    .put("post_contact", JSONArray(postContact))
