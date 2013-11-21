var mixpanel = require('./index'),
    util = require("util"),
    csv = require("csv"),
    async = require("async");

// Get api keys from local config file.
var fs = require("fs"),
    //configFile = "development.json",
    //configFile = "staging.json",
    configFile = "production.json",
    configPath = "./local/";

var api_key  = '',
    api_secret = '',
    REQUEST_INTERVAL = 500; // Short break between requests to prevent rate limiting in case they use it.

try {
    var config = JSON.parse(fs.readFileSync(configPath + configFile));
    api_key = config.apiKey;
    api_secret = config.apiSecret;
}
catch(ex) {
    console.log("Error reading ", configPath + configFile);
}

// Create Mixpanel instance.
var mx = new mixpanel({
    api_key: api_key,
    api_secret: api_secret
});

var pageSize, totalCount, sessionId, numRequests, recordsCount = 0;
var outFilename = '/tmp/data.tsv';

// A single sample datum, for inferring what fields are available.
var datum = { '$distinct_id': '142735c9c18a-0af4a4507-6100f53-c0000-142735c9c1c54',
              '$properties':
              { '$browser': 'Mobile Safari',
                '$campaigns': [ 22366, 25320, 51670 ],
                '$city': 'Springfield',
                '$country_code': 'US',
                '$created': '2013-11-19T21:35:54',
                '$deliveries': [ 37611399, 37958769, 38011197 ],
                '$email': 'qmulus1@yahoo.com',
                '$first_name': 'Will',
                '$initial_referrer': 'http://www.fluencia.com/signup/?utm_source=sd_desktop&utm_medium=main_content&utm_content=learnspanishproductimage',
                '$initial_referring_domain': 'www.fluencia.com',
                '$last_name': null,
                '$last_seen': '2013-11-20T23:54:49',
                '$os': 'iOS',
                '$region': 'Oregon',
                '$transactions': [ { '$amount': 14.95, '$time': '2013-11-20T23:37:40' } ],
                birth_year: 1979,
                email_announcements: true,
                email_newsletter: true,
                email_offers: true,
                email_reminders: true,
                gender: 'M',
                goal_explanation: 'So that I communicate with members of my family.',
                goal_hours: 5,
                initial_referrer: 'http://www.fluencia.com/signup/?utm_source=sd_desktop&utm_medium=main_content&utm_content=learnspanishproductimage',
                initial_referring_domain: 'www.fluencia.com',
                last_login: '2013-11-20T21:26:23',
                learning_lang: 'es',
                lessons_completed: 12,
                native_lang: 'en',
                self_assessment: 1,
                sub_activated_at: '2013-11-20T23:37:34',
                sub_attempted_at: '2013-11-20T23:36:43',
                sub_canceled_at: null,
                sub_current_period_ends_at: '2013-12-20T23:37:34',
                sub_current_period_started_at: '2013-11-20T23:37:34',
                sub_expires_at: null,
                sub_plan_code: '0001-01',
                sub_plan_months: 1,
                sub_plan_ppm: 14.95,
                sub_state: 'subscriber',
                sub_uuid: '23e7be29cab64ca54aabd449be999263',
                test_group: 60,
                trial_lessons_allowed: 15,
                trial_lessons_completed: 10,
                user_agent: 'Mozilla/5.0 (iPad; CPU OS 7_0_2 like Mac OS X) AppleWebKit/537.51.1 (KHTML, like Gecko) Version/7.0 Mobile/11A501 Safari/9537.53',
                user_id: '528c200af113bd444f00295c',
                user_os: 'iOS 7.0.2',
                user_signup_device_type: 'tablet',
                user_signup_ua: 'Mobile Safari 7.0',
                user_ua: 'Mobile Safari 7.0',
                utm_campaign: 'simplesignupredirect',
                utm_content: 'learnspanishproductimage',
                utm_medium: 'main_content',
                utm_source: 'sd_desktop'
              }
            };

// Initial generation of columns. Re-run when available properties change to see what the new ones are.
//var columns = Object.keys(datum.$properties);
//console.log("all columns", columns);

// Define it now that we have a list.
var columns = [ '$browser',
                '$campaigns',
                '$city',
                '$country_code',
                '$created',
                '$deliveries',
                '$email',
                '$first_name',
                '$initial_referrer',
                '$initial_referring_domain',
                '$last_name',
                '$last_seen',
                '$os',
                '$region',
                '$transactions',
                'birth_year',
                'email_announcements',
                'email_newsletter',
                'email_offers',
                'email_reminders',
                'gender',
                'goal_explanation',
                'goal_hours',
                'initial_referrer',
                'initial_referring_domain',
                'last_login',
                'learning_lang',
                'lessons_completed',
                'native_lang',
                'self_assessment',
                'sub_activated_at',
                'sub_attempted_at',
                'sub_canceled_at',
                'sub_current_period_ends_at',
                'sub_current_period_started_at',
                'sub_expires_at',
                'sub_plan_code',
                'sub_plan_months',
                'sub_plan_ppm',
                'sub_state',
                'sub_uuid',
                'test_group',
                'trial_lessons_allowed',
                'trial_lessons_completed',
                'user_agent',
                'user_id',
                'user_os',
                'user_signup_device_type',
                'user_signup_ua',
                'user_ua',
                'utm_campaign',
                'utm_content',
                'utm_medium',
                'utm_source' ];
var outputData = [];

// Initial request: Get the size of each page, total number of
// records, and session_id. Figure out how many requests to make.
mx.request(
    'engage',
    {},
    function(error, data) {
        console.log("Making initial request...");
        if(error) console.log(error);

        console.log("page_size: ", data.page_size, "total: ", data.total, "session_id: ", data.session_id);

        pageSize = parseInt(data.page_size, 10);
        totalCount = parseInt(data.total, 10);
        numRequests = Math.ceil(totalCount / pageSize);
        sessionId = data.session_id;

        // Sanity check.
        console.log("Parsed: pageSize totalCount numRequests recordsCount", pageSize, totalCount, numRequests, recordsCount);

        // Inspect user data format to see what columns are available
        // and what the data looks like. Rerun when columns have
        // changed.
        // for (var result in data.results) {
        //     var user = data.results[result];
        //     if(user.$properties.sub_state == "subscriber") {
        //         console.log("User props: ", util.inspect(user, {depth: null}));
        //     }
        // }

        // Get the rest of the data.
        doLoop();

    }
);

// Loop to fetch data.
var doLoop = function() {
    var makeRequest = function(i, next) {
        mx.request(
            'engage',
            {
                page: i,
                session_id: sessionId
            },
            function(error, data) {
                if(error) {
                    console.log("[Request " + i + "] Error: ", error);
                    next(error);
                } else {
                    recordsCount += pageSize;
                    console.log("[Request " + i + "] recordsCount: ", recordsCount);

                    // Not every user will have every property.
                    for (var result in data.results) {
                        var user = data.results[result];

                        // Fix certain columns and fill in blank values.
                        var fixColumns = function(col) {
                            if(col == "$campaigns" || col == "$deliveries") {
                                // These are arrays.
                                if(user.$properties[col]) {
                                    return user.$properties[col].join(" ");
                                }
                                else {
                                    return "";
                                }
                            }
                            else if(col == "$transactions") {
                                // $transactions looks like [ { '$amount': 95.4, '$time': '2013-09-16T20:12:49' } ]
                                var trans = user.$properties[col];
                                if(trans) {
                                    var accum = [];
                                    for(var t in trans) {
                                        accum.push(trans[t].$amount);
                                    }
                                    //console.log("Returning accum", accum.join(" "));
                                    return accum.join(" ");
                                }
                                else {
                                    return "";
                                }
                            }
                            else if(col == "goal_explanation") {
                                // Blank out this column.
                                return "";
                            }
                            else {
                                // Default to empty string if no data for this column.
                                return user.$properties[col] || "";
                            }
                        };
                        var values = columns.map(fixColumns);
                        outputData.push(values);
                    }
                    // Short break between requests to prevent rate
                    // limiting (not sure if MP has any rate limits or
                    // not).
                    setTimeout(next, REQUEST_INTERVAL);
                }
            }
        );
    };

    // Loop to make the requests. Save the data.
    async.timesSeries(numRequests, makeRequest, function(err) {
        if(err) {
            console.log("Finished MP requests with error: ", err);
        }
        else {
            console.log("Finished MP requests without error.");
        }

        // Write columns.
        console.log("Writing to: ", outFilename);
        outputData = [columns].concat(outputData);

        // Set output options.
        var toOpts = {
            delimiter: "\t"
            //quoted: true
        };
        csv().from.array(outputData).to(outFilename).to.options(toOpts);
    });

};
