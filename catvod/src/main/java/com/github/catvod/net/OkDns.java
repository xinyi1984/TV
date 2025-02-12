package com.github.catvod.net;

import androidx.annotation.NonNull;

import java.net.InetAddress;
import java.net.UnknownHostException;
import java.util.HashMap;
import java.util.List;
import java.util.regex.Pattern;

import okhttp3.Dns;
import okhttp3.dnsoverhttps.DnsOverHttps;

public class OkDns implements Dns {

    private final Pattern IP = Pattern.compile("\\b(?:(?:[0-9]{1,3}\\.){3}[0-9]{1,3}|[0-9a-fA-F:]{2,39})\\b");
    private final HashMap<String, String> map;
    private DnsOverHttps doh;

    public OkDns() {
        this.map = new HashMap<>();
    }

    public void setDoh(DnsOverHttps doh) {
        this.doh = doh;
    }

    public void addAll(List<String> hosts) {
        for (String host : hosts) {
            if (!host.contains("=")) continue;
            String[] splits = host.split("=");
            map.put(splits[0], splits[1]);
        }
    }

    private boolean isAddress(String input) {
        try {
            return IP.matcher(input).find();
        } catch (Exception e) {
            return false;
        }
    }

    @NonNull
    @Override
    public List<InetAddress> lookup(@NonNull String hostname) throws UnknownHostException {
        String target = map.containsKey(hostname) ? map.get(hostname) : hostname;
        return isAddress(target) ? List.of(InetAddress.getByName(target)) : (doh != null ? doh : Dns.SYSTEM).lookup(target);
    }
}

