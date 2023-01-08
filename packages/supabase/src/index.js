var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
import { createClient, } from '@supabase/supabase-js';
import invariant from 'tiny-invariant';
import { createServerClient } from '@supabase/auth-helpers-remix';
import api from './supabase-api';
export var client = function () {
    invariant(process.env.SUPABASE_URL, 'SUPABASE_URL not defined.');
    invariant(process.env.SUPABASE_SERVICE_KEY, 'SUPABASE_SERVICE_KEY not defined.');
    var supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
    return __assign({}, api(supabase));
};
export var remixClient = function (request) {
    invariant(process.env.SUPABASE_URL, 'SUPABASE_URL not defined.');
    invariant(process.env.SUPABASE_ANON_KEY, 'SUPABASE_ANON_KEY not defined.');
    var response = new Response();
    var supabase = createServerClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
        request: request,
        response: response
    });
    return __assign(__assign({}, api(supabase)), { response: response, getSession: function () { return supabase.auth.getSession(); } });
};
export var verifyResult = function (_a) {
    var data = _a.data, error = _a.error;
    if (error) {
        throw error;
    }
    return data;
};
export var verifySingleResult = function (_a) {
    var data = _a.data, error = _a.error;
    if (error) {
        throw error;
    }
    return data;
};
export * from './services/match-service';
export * from './types';
