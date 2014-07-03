// Query for users whose id does not look like a MP distinct_id, but
// rather like our user_id.
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
    REQUEST_INTERVAL = 100; // Short break between requests to prevent rate limiting in case they use it.

try {
    var config = JSON.parse(fs.readFileSync(configPath + configFile));
    api_key = config.apiKey;
    api_secret = config.apiSecret;
}
catch(ex) {
    console.log("Error reading ", configPath + configFile);
}

var mx = new mixpanel({
    api_key: api_key,
    api_secret: api_secret
});

var pageSize, totalCount, sessionId, numRequests, recordsCount = 0;
var outFilename = '/tmp/data.csv';

var outputData = [];

// Get the size of each page, total number of records, and session_id. Figure out how many requests to make.
mx.request(
    'engage',
    {
      // Leave empty to query *all* users.
      //where: 'properties["user_id"] == "52616f45159afbbe5e00713b"' // works!
      //where: '"$distinct_id" == "141cc999f8f455-0d3b204b3-69132675-1fa400-141cc999f90561"'
      //where: 'properties["birth_year"] == 1989' // works!
    },
    function(error, data) {
        if(error) console.log(error);
        console.log("page_size: ", data.page_size, "total: ", data.total, "session_id: ", data.session_id);
        pageSize = parseInt(data.page_size, 10);
        totalCount = parseInt(data.total, 10);
        numRequests = Math.ceil(totalCount / pageSize);
        sessionId = data.session_id;

        // sanity check
        console.log("pageSize totalCount numRequests recordsCount", pageSize, totalCount, numRequests, recordsCount);

        // Inspect user data format.
        // for (var result in data.results) {
        //     var user = data.results[result];
        //     if(user.$properties.sub_state == "subscriber") {
        //         console.log("User props: ", util.inspect(user, {depth: null}));
        //     }
        // }

        doLoop();

    }
);

var doLoop = function() {
    var makeRequest = function(i, next) {
        mx.request(
            'engage',
            {
                //where: "properties[\"$distinct_id\"] == \"52616f45159afbbe5e00713b\"",
                //where: "properties[\"$distinct_id\"] == \"141cc999f8f455-0d3b204b3-69132675-1fa400-141cc999f90561\"",
                //where: 'properties["birth_year"]=="1989"',
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
                        //console.log("distinct_id", user.$distinct_id);

                        // if it has no -, it's not ok.
                        if(user.$distinct_id.indexOf("-") < 0) {
                            // if it does not have true for email_newsletter, we are unsubscribing them.
                            //console.log("email_newsletter", user.$properties.email_newsletter);
                            var values = [user.$distinct_id, user.$properties.$email, user.$properties.email_newsletter, user.$properties.$first_name, user.$properties.$created];
                            outputData.push(values);
                        }

                    }
                    // Short break between requests to prevent rate
                    // limiting (not sure if MP has any rate limits or
                    // not).
                    setTimeout(next, 100);
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
        outputData = [["$distinct_id", "$email",'email_newsletter', "$first_name","$created"]].concat(outputData);

        var toOpts = {
            //delimiter: "\t"
            //quoted: true
        };
        csv().from.array(outputData).to(outFilename).to.options(toOpts);
    });

};
