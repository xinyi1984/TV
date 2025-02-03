package com.fongmi.android.tv.player.extractor;

import com.fongmi.android.tv.player.Source;
import com.github.catvod.net.OkHttp;
import com.github.catvod.utils.Json;
import com.github.catvod.utils.Util;
import com.google.common.net.HttpHeaders;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

import okhttp3.Headers;

public class Youtube implements Source.Extractor {

    @Override
    public boolean match(String scheme, String host) {
        return host.contains("youtube.com") || host.contains("youtu.be");
    }

    @Override
    public String fetch(String url) throws Exception {
        String html = OkHttp.newCall(url, Headers.of(HttpHeaders.USER_AGENT, Util.CHROME)).execute().body().string();
        Matcher matcher = Pattern.compile("var ytInitialPlayerResponse =(.*?\\});").matcher(html);
        if (matcher.find()) return getHlsManifestUrl(matcher);
        return "";
    }

    private String getHlsManifestUrl(Matcher matcher) {
        JsonObject object = Json.parse(matcher.group(1)).getAsJsonObject();
        JsonElement hlsManifestUrl = object.get("streamingData").getAsJsonObject().get("hlsManifestUrl");
        if (hlsManifestUrl.isJsonArray()) return hlsManifestUrl.getAsJsonArray().get(0).getAsString();
        return hlsManifestUrl.getAsString();
    }

    @Override
    public void stop() {
    }

    @Override
    public void exit() {
    }
}
