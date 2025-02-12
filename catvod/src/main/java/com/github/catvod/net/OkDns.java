package com.github.catvod.net;

import androidx.annotation.NonNull;

import java.net.InetAddress;
import java.net.UnknownHostException;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;

import okhttp3.Dns;
import okhttp3.dnsoverhttps.DnsOverHttps;

public class OkDns implements Dns {

    private final HashMap<String, List<InetAddress>> map;
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
            String oldHost = splits[0];
            String newHost = splits[1];
            if (!map.containsKey(oldHost)) map.put(oldHost, new ArrayList<>());
            map.get(oldHost).addAll(getAllByName(newHost));
        }
    }

    private List<InetAddress> getAllByName(String host) {
        try {
            return new ArrayList<>(Arrays.asList(InetAddress.getAllByName(host)));
        } catch (Exception e) {
            return new ArrayList<>();
        }
    }

    @NonNull
    @Override
    public List<InetAddress> lookup(@NonNull String hostname) throws UnknownHostException {
        return map.containsKey(hostname) ? map.get(hostname) : (doh != null ? doh : Dns.SYSTEM).lookup(hostname);
    }
}

