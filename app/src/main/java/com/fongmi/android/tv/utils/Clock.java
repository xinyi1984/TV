package com.fongmi.android.tv.utils;

import android.widget.TextView;

import com.fongmi.android.tv.App;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Date;
import java.util.Locale;
import java.util.Timer;
import java.util.TimerTask;

public class Clock {

    private DateTimeFormatter format;
    private Callback callback;
    private final Date date;
    private List<TextView> views; // 修改：从单个TextView改为TextView列表
    private Timer timer;

    public static Clock create() {
        return new Clock();
    }

    public static Clock create(TextView view) {
        return new Clock().view(view).format("HH:mm:ss");
    }

    // 新增：支持多个TextView的创建方法
    public static Clock create(TextView... views) {
        Clock clock = new Clock().format("HH:mm:ss");
        for (TextView view : views) {
            clock.view(view);
        }
        return clock;
    }

    public Clock() {
        this.date = new Date();
        this.views = new ArrayList<>(); // 新增：初始化TextView列表
    }

    public Clock view(TextView view) {
        this.views.add(view); // 修改：将TextView添加到列表而不是设置单个view
        return this;
    }

    public Clock format(String format) {
        this.format = DateTimeFormatter.ofPattern(format, Locale.getDefault());
        return this;
    }

    public void setCallback(Callback callback) {
        this.callback = callback;
    }

    public void start() {
        timer = new Timer();
        timer.schedule(new TimerTask() {
            @Override
            public void run() {
                App.post(() -> doJob());
            }
        }, 0, 1000);
    }

    private void doJob() {
        try {
            long time = System.currentTimeMillis();
            if (callback != null) callback.onTimeChanged(time);
            // 修改：遍历所有TextView并更新时间显示
            for (TextView view : views) {
                if (view != null) view.setText(format.format(LocalDateTime.now()));
            }  
        } catch (Exception ignored) {
        }
    }

    public Clock stop() {
        if (timer != null) timer.cancel();
        return this;
    }

    public void release() {
        if (timer != null) timer.cancel();
        if (callback != null) callback = null;
        if (views != null) views.clear(); // 新增：清理TextView列表
    }

    public interface Callback {

        void onTimeChanged(long time);
    }
}
