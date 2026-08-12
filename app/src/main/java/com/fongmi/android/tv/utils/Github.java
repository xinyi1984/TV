package com.fongmi.android.tv.utils;

import android.os.Build;

public class Github {
    
    // 基础URL
    private static final String BASE_URL = "https://raw.githubusercontent.com/xinyi1984/Release/fongmi";
    
    // 根据设备SDK版本选择目录
    private static String getApkDir() {
        // 获取设备SDK版本
        int sdkVersion = Build.VERSION.SDK_INT;
        
        // Android 7.0及以上 (API 24+)
        if (sdkVersion >= Build.VERSION_CODES.N) {
            return "/apk/minSdk24/";
        } 
        // Android 5.0 - 5.1 (API 21-22)
        else {
            return "/apk/minSdk21/";
        }
    }
    
    // 获取完整的URL
    private static String getUrl(String name) {
        String dir = getApkDir();
        return BASE_URL + dir + name;
    }
    
    // 获取JSON URL（JSON文件放在对应的minSdk版本的文件夹下）
    public static String getJson(String name) {
        return getUrl(name + ".json");
    }
    
    // 获取APK URL
    public static String getApk(String name) {
        return getUrl(name + ".apk");
    }
    
    // 获取设备信息
    public static String getDeviceInfo() {
        return "Android " + Build.VERSION.RELEASE + " (SDK " + Build.VERSION.SDK_INT + ")";
    }
    
    // 获取当前使用的APK目录名
    public static String getCurrentApkDirName() {
        int sdkVersion = Build.VERSION.SDK_INT;
        return sdkVersion >= Build.VERSION_CODES.N ? "minSdk24" : "minSdk21";
    }
}
