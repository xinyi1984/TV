package com.fongmi.android.tv.bean;

import android.text.TextUtils;

import com.fongmi.android.tv.App;
import com.google.gson.annotations.SerializedName;
import com.google.gson.reflect.TypeToken;

import java.lang.reflect.Type;
import java.util.Collections;
import java.util.List;

public class XStream {

    @SerializedName("name")
    private String name;
    @SerializedName("stream_id")
    private String streamId;
    @SerializedName("stream_icon")
    private String streamIcon;
    @SerializedName("epg_channel_id")
    private String epgChannelId;
    @SerializedName("category_id")
    private String categoryId;

    public static List<XStream> arrayFrom(String str) {
        Type listType = new TypeToken<List<XStream>>() {}.getType();
        List<XStream> items = App.gson().fromJson(str, listType);
        return items == null ? Collections.emptyList() : items;
    }

    public String getName() {
        return TextUtils.isEmpty(name) ? "" : name;
    }

    public String getStreamId() {
        return TextUtils.isEmpty(streamId) ? "" : streamId;
    }

    public String getStreamIcon() {
        return TextUtils.isEmpty(streamIcon) ? "" : streamIcon;
    }

    public String getEpgChannelId() {
        return TextUtils.isEmpty(epgChannelId) ? "" : epgChannelId;
    }

    public String getCategoryId() {
        return TextUtils.isEmpty(categoryId) ? "" : categoryId;
    }
}
