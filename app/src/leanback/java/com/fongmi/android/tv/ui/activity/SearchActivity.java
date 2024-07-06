package com.fongmi.android.tv.ui.activity;

import android.app.Activity;
import android.content.Intent;
import android.text.Editable;
import android.text.TextUtils;
import android.view.KeyEvent;
import android.view.View;
import android.view.inputmethod.EditorInfo;

import androidx.annotation.NonNull;
import androidx.viewbinding.ViewBinding;

import com.fongmi.android.tv.App;
import com.fongmi.android.tv.R;
import com.fongmi.android.tv.Setting;
import com.fongmi.android.tv.bean.Hot;
import com.fongmi.android.tv.bean.Site;
import com.fongmi.android.tv.bean.Suggest;
import com.fongmi.android.tv.bean.SuggestTwo;
import com.fongmi.android.tv.databinding.ActivitySearchBinding;
import com.fongmi.android.tv.impl.Callback;
import com.fongmi.android.tv.impl.SiteCallback;
import com.fongmi.android.tv.ui.adapter.RecordAdapter;
import com.fongmi.android.tv.ui.adapter.WordAdapter;
import com.fongmi.android.tv.ui.base.BaseActivity;
import com.fongmi.android.tv.ui.custom.CustomKeyboard;
import com.fongmi.android.tv.ui.custom.CustomTextListener;
import com.fongmi.android.tv.ui.custom.SpaceItemDecoration;
import com.fongmi.android.tv.ui.dialog.SiteDialog;
import com.fongmi.android.tv.utils.KeyUtil;
import com.fongmi.android.tv.utils.Util;
import com.github.catvod.net.OkHttp;
import com.google.common.net.HttpHeaders;

import java.io.IOException;
import java.net.URLEncoder;
import java.util.HashMap;
import java.util.List;

import okhttp3.Call;
import okhttp3.Headers;
import okhttp3.Response;

public class SearchActivity extends BaseActivity implements WordAdapter.OnClickListener, RecordAdapter.OnClickListener, CustomKeyboard.Callback, SiteCallback {

    private ActivitySearchBinding mBinding;
    private RecordAdapter mRecordAdapter;
    private WordAdapter mWordAdapter;

    public static void start(Activity activity) {
        activity.startActivity(new Intent(activity, SearchActivity.class));
    }

    public static String convertBopomofoToPinyin(String bopomofoString) {
        HashMap<String, String> bopomofoToPinyinMap = new HashMap<String, String>();
        bopomofoToPinyinMap.put("ㄅ", "b");
        bopomofoToPinyinMap.put("ㄆ", "p");
        bopomofoToPinyinMap.put("ㄇ", "m");
        bopomofoToPinyinMap.put("ㄈ", "f");
        bopomofoToPinyinMap.put("ㄉ", "d");
        bopomofoToPinyinMap.put("ㄊ", "t");
        bopomofoToPinyinMap.put("ㄋ", "n");
        bopomofoToPinyinMap.put("ㄌ", "l");
        bopomofoToPinyinMap.put("ㄍ", "g");
        bopomofoToPinyinMap.put("ㄎ", "k");
        bopomofoToPinyinMap.put("ㄏ", "h");
        bopomofoToPinyinMap.put("ㄐ", "j");
        bopomofoToPinyinMap.put("ㄑ", "q");
        bopomofoToPinyinMap.put("ㄒ", "x");
        bopomofoToPinyinMap.put("ㄓ", "z");
        bopomofoToPinyinMap.put("ㄔ", "c");
        bopomofoToPinyinMap.put("ㄕ", "s");
        bopomofoToPinyinMap.put("ㄖ", "r");
        bopomofoToPinyinMap.put("ㄗ", "z");
        bopomofoToPinyinMap.put("ㄘ", "c");
        bopomofoToPinyinMap.put("ㄙ", "s");
        bopomofoToPinyinMap.put("ㄚ", "a");
        bopomofoToPinyinMap.put("ㄛ", "o");
        bopomofoToPinyinMap.put("ㄜ", "e");
        bopomofoToPinyinMap.put("ㄝ", "e"); // can also be ie
        bopomofoToPinyinMap.put("ㄞ", "ai");
        bopomofoToPinyinMap.put("ㄟ", "ei");
        bopomofoToPinyinMap.put("ㄠ", "ao");
        bopomofoToPinyinMap.put("ㄡ", "ou");
        bopomofoToPinyinMap.put("ㄢ", "an");
        bopomofoToPinyinMap.put("ㄣ", "en");
        bopomofoToPinyinMap.put("ㄤ", "ang");
        bopomofoToPinyinMap.put("ㄥ", "eng");
        bopomofoToPinyinMap.put("ㄦ", "er");
        bopomofoToPinyinMap.put("ㄧ", "y");
        bopomofoToPinyinMap.put("ㄨ", "w");
        bopomofoToPinyinMap.put("ㄩ", "yu");

        StringBuilder pinyinStringBuilder = new StringBuilder();
        for (char bopomofoChar : bopomofoString.toCharArray()) {
            String pinyin = bopomofoToPinyinMap.get(String.valueOf(bopomofoChar));
            if (pinyin != null) {
                pinyinStringBuilder.append(pinyin);
            } else {
                // Handle characters not found in the map (e.g., tones)
                pinyinStringBuilder.append(bopomofoChar); // Add the character as is
            }
        }
        return pinyinStringBuilder.toString();
    }

    @Override
    protected ViewBinding getBinding() {
        return mBinding = ActivitySearchBinding.inflate(getLayoutInflater());
    }

    @Override
    protected void initView() {
        CustomKeyboard.init(this, mBinding);
        setRecyclerView();
        getHot();
    }

    @Override
    protected void initEvent() {
        mBinding.keyword.setOnEditorActionListener((textView, actionId, event) -> {
            if (actionId == EditorInfo.IME_ACTION_DONE) onSearch();
            return true;
        });
        mBinding.keyword.addTextChangedListener(new CustomTextListener() {
            @Override
            public void afterTextChanged(Editable s) {
                if (s.toString().isEmpty()) getHot();
                else getSuggest(s.toString());
            }
        });
        mBinding.mic.setListener(this, new CustomTextListener() {
            @Override
            public void onEndOfSpeech() {
                mBinding.keyword.requestFocus();
                mBinding.mic.stop();
            }

            @Override
            public void onResults(String result) {
                mBinding.keyword.setText(result);
                mBinding.keyword.setSelection(mBinding.keyword.length());
            }
        });
    }

    private void setRecyclerView() {
        mBinding.wordRecycler.setHasFixedSize(true);
        mBinding.wordRecycler.addItemDecoration(new SpaceItemDecoration(1, 16));
        mBinding.wordRecycler.setAdapter(mWordAdapter = new WordAdapter(this));
        mBinding.recordRecycler.setHasFixedSize(true);
        mBinding.recordRecycler.addItemDecoration(new SpaceItemDecoration(1, 16));
        mBinding.recordRecycler.setAdapter(mRecordAdapter = new RecordAdapter(this));
    }

    private void getHot() {
        mBinding.hint.setText(R.string.search_hot);
        mWordAdapter.addAll(Hot.get(Setting.getHot()));
        OkHttp.newCall("https://api.web.360kan.com/v1/rank?cat=1", Headers.of(HttpHeaders.REFERER, "https://www.360kan.com/rank/general")).enqueue(new Callback() {
            @Override
            public void onResponse(@NonNull Call call, @NonNull Response response) throws IOException {
                List<String> items = Hot.get(response.body().string());
                if (mWordAdapter.getItemCount() > 0) return;
                App.post(() -> mWordAdapter.addAll(items));
            }
        });
    }

    private void getSuggest(String text) {
        mBinding.hint.setText(R.string.search_suggest);
        mWordAdapter.clear();
        OkHttp.newCall("https://tv.aiseet.atianqi.com/i-tvbin/qtv_video/search/get_search_smart_box?format=json&page_num=0&page_size=10&key=" + URLEncoder.encode(convertBopomofoToPinyin(text))).enqueue(new Callback() {
            @Override
            public void onResponse(@NonNull Call call, @NonNull Response response) throws IOException {
                if (mBinding.keyword.getText().toString().trim().isEmpty()) return;
                List<String> items = SuggestTwo.get(response.body().string());
                App.post(() -> mWordAdapter.appendAll(items));
            }
        });
        OkHttp.newCall("https://suggest.video.iqiyi.com/?if=mobile&key=" + URLEncoder.encode(convertBopomofoToPinyin(text))).enqueue(new Callback() {
            @Override
            public void onResponse(@NonNull Call call, @NonNull Response response) throws IOException {
                if (mBinding.keyword.getText().toString().trim().isEmpty()) return;
                List<String> items = Suggest.get(response.body().string());
                App.post(() -> mWordAdapter.appendAll(items), 200);
            }
        });
    }

    @Override
    public void onItemClick(String text) {
        mBinding.keyword.setText(text);
        onSearch();
    }

    @Override
    public void onDataChanged(int size) {
        mBinding.recordLayout.setVisibility(size == 0 ? View.GONE : View.VISIBLE);
    }

    @Override
    public void onSearch() {
        String keyword = mBinding.keyword.getText().toString().trim();
        mBinding.keyword.setSelection(mBinding.keyword.length());
        Util.hideKeyboard(mBinding.keyword);
        if (TextUtils.isEmpty(keyword)) return;
        CollectActivity.start(this, convertBopomofoToPinyin(keyword));
        App.post(() -> mRecordAdapter.add(keyword), 250);
    }

    @Override
    public boolean dispatchKeyEvent(KeyEvent event) {
        if (KeyUtil.isMenuKey(event)) showDialog();
        return super.dispatchKeyEvent(event);
    }

    @Override
    public void showDialog() {
        SiteDialog.create(this).search().show();
    }

    @Override
    public void onRemote() {
        PushActivity.start(this, 1);
    }

    @Override
    public void setSite(Site item) {
    }

    @Override
    public void onChanged() {
    }

    @Override
    protected void onResume() {
        super.onResume();
        mBinding.keyword.requestFocus();
    }
}
