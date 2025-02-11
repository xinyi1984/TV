package com.github.catvod.net;

import androidx.annotation.NonNull;

import java.net.InetAddress;
import java.net.UnknownHostException;
import java.util.HashMap;
import java.util.List;

import okhttp3.Dns;

public class OkDns implements Dns {

    private final HashMap<String, String> map;
    private Dns doh;

    public OkDns() {
        this.map = new HashMap<>();
    }

    public void setDoh(Dns doh) {
        this.doh = doh;
    }

    public void addAll(List<String> hosts) {
        for (String host : hosts) {
            if (!host.contains("=")) continue;
            String[] splits = host.split("=");
            map.put(splits[0], splits[1]);
        }
    }

    @NonNull
    @Override
    public List<InetAddress> lookup(@NonNull String hostname) throws UnknownHostException {
        if (map.containsKey(hostname)) return Dns.SYSTEM.lookup(map.get(hostname));
        return doh != null ? doh.lookup(hostname) : Dns.SYSTEM.lookup(hostname);
    }
}

