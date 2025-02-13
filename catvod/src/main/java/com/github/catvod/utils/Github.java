package com.github.catvod.utils;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public class Github {

    public static final String JSON_URL = "https://raw.githubusercontent.com/FongMi/Release/fongmi";
    private static final int MAX_RETRIES = 3;

    private static String getUrl(String path, String name) {
        return JSON_URL + "/" + path + "/" + name;
    }

    public static String getJson(boolean dev, String name) {
        return getUrl("apk/" + (dev ? "dev" : "release"), name + ".json");
    }

    public static String getApk(boolean dev, String name) {
        String latestTag = fetchLatestTag();
        if (latestTag != null) {
            return "https://ghfast.top/https://github.com/xinyi1984/TVBox-TV/releases/download/" + latestTag + "/" + name + ".apk";
        }
        return null;
    }

    private static String fetchLatestTag() {
        int retries = 0;
        while (retries < MAX_RETRIES) {
            try {
                URL url = new URL("https://api.github.com/repos/xinyi1984/TVBox-TV/tags");
                HttpURLConnection connection = (HttpURLConnection) url.openConnection();
                connection.setRequestMethod("GET");

                if (connection.getResponseCode() == HttpURLConnection.HTTP_OK) {
                    BufferedReader reader = new BufferedReader(new InputStreamReader(connection.getInputStream()));
                    StringBuilder response = new StringBuilder();
                    String line;
                    while ((line = reader.readLine()) != null) {
                        response.append(line);
                    }
                    reader.close();

                    Pattern pattern = Pattern.compile("\"name\":\"([^\"]+)\"");
                    Matcher matcher = pattern.matcher(response.toString());
                    if (matcher.find()) {
                        return matcher.group(1);
                    }
                }
            } catch (IOException e) {
                System.err.println("Network request failed, retrying " + (retries + 1) + " of " + MAX_RETRIES);
            }
            retries++;
        }
        System.err.println("Failed to fetch latest tag after " + MAX_RETRIES + " retries.");
        return null;
    }
}
