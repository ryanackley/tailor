if (chrome && chrome.storage){
    chrome.storage.local.get(null, function(data){
        chromeStorageObj = data || {};
    });
}