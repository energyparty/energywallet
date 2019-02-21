/*
Copyright (c) 2016-Present Energyparty and Energywallet Developers
Distributed under the AGPL 3.0 with the OpenSSL exception, see the
accompanying file LICENSE or https://github.com/energyparty/energywallet
*/

function PendingActionViewModel(txHash, category, data, when) {
  var self = this;
  self.WHEN = when;
  self.TX_HASH = txHash;
  self.CATEGORY = category;
  self.DATA = data;
  self.ICON_CLASS = ENTITY_ICONS[category];
  self.COLOR_CLASS = ENTITY_NOTO_COLORS[category];
  self.ACTION_TEXT = PendingActionViewModel.calcText(category, data);
}
PendingActionViewModel.calcText = function(category, data) {
  var desc = "";
  var divisible = null;
  var pending = data['mempool'] ? 'Unconfirmed' : 'Pending';
  //The category being allowable was checked in the factory class
  if(data['source'] && data['asset']) {
    divisible = data['divisible'] !== undefined ? data['divisible'] : (data['_divisible'] !== undefined ? data['_divisible'] : WALLET.getAddressObj(data['source']).getAssetObj(data['asset']).DIVISIBLE);
  }

  if(category == 'burns') {
    desc = i18n.t("pend_or_unconf_burn", pending, normalizeQuantity(data['quantity']));
  } else if(category == 'sends') {
    desc = i18n.t("pend_or_unconf_send", pending, numberWithCommas(normalizeQuantity(data['quantity'], divisible)), data['asset'],
      getAddressLabel(data['source']), getAddressLabel(data['destination']));
  } else if(category == 'orders') {
    desc = i18n.t("pend_or_unconf_order", pending, numberWithCommas(normalizeQuantity(data['give_quantity'], data['_give_divisible'])),
      data['give_asset'], numberWithCommas(normalizeQuantity(data['get_quantity'], data['_get_divisible'])), data['get_asset']);
  } else if(category == 'issuances') {
    if(data['transfer_destination']) {
      desc = i18n.t("pend_or_unconf_transfer", pending , data['asset'], getAddressLabel(data['source']), getAddressLabel(data['transfer_destination']));
    } else if(data['locked']) {
      desc = i18n.t("pend_or_unconf_lock", pending, data['asset']);
    } else if(data['quantity'] == 0) {
      desc = i18n.t("pend_or_unconf_change_desc", pending, data['asset'], data['description']);
    } else {
      //See if this is a new issuance or not
      var assetObj = null;
      var addressesWithAsset = WALLET.getAddressesWithAsset(data['asset']);
      if(addressesWithAsset.length)
        assetObj = WALLET.getAddressObj(addressesWithAsset[0]).getAssetObj(data['asset']);
      
      if(assetObj) { //the asset exists in our wallet already somewhere, so it's an additional issuance of more units for it
        desc = i18n.t("pend_or_unconf_issuance_add", pending, numberWithCommas(normalizeQuantity(data['quantity'], data['divisible'])),
          data['asset']);
      } else { //new issuance
        desc = i18n.t("pend_or_unconf_issuance", pending, data['asset'], numberWithCommas(normalizeQuantity(data['quantity'], data['divisible'])));
      }
    }
  } else if(category == 'broadcasts') {
    desc = i18n.t("pend_or_unconf_broadcast", pending, data['text'], data['value']);
  } else if(category == 'bets') {
    desc = i18n.t("pend_or_unconf_bet", pending, data['bet_type'], getAddressLabel(data['feed_address']),
      numberWithCommas(normalizeQuantity(data['wager_quantity'])),
      numberWithCommas(normalizeQuantity(data['counterwager_quantity'])));  
  } else if(category == 'dividends') {
    
    var divUnitDivisible;
    if (WALLET.getAddressObj(data['source'])) {
      divUnitDivisible = WALLET.getAddressObj(data['source']).getAssetObj(data['dividend_asset']).DIVISIBLE;
      desc = i18n.t("pend_or_unconf_dividend_payment", pending, numberWithCommas(normalizeQuantity(data['quantity_per_unit'], divUnitDivisible)),
        data['dividend_asset'], data['asset']);
    } else {
      divUnitDivisible = data['dividend_asset_divisible'];
      desc = i18n.t("pend_or_unconf_dividend_reception", pending, numberWithCommas(normalizeQuantity(data['quantity_per_unit'], divUnitDivisible)),
        data['dividend_asset'], data['asset']);
    }
    
  
  } else if(category == 'cancels') {
    desc = i18n.t("pend_or_unconf_cancellation", pending, data['_type'], data['_tx_index']);
  } else if(category == 'btcpays') {
    desc = i18n.t("pend_or_unconf_btcpay", pending, getAddressLabel(data['source']));
  } else if(category == 'order_matches') {

    if (WALLET.getAddressObj(data['tx1_address']) && data['forward_asset'] == 'ENRG' && data['_status'] == 'pending') {
      desc = i18n.t("pend_or_unconf_wait_btcpay", numberWithCommas(normalizeQuantity(data['forward_quantity'])), getAddressLabel(data['tx0_address']));
    } else if (WALLET.getAddressObj(data['tx0_address']) && data['backward_asset'] == 'ENRG' && data['_status'] == 'pending') {
      desc = i18n.t("pend_or_unconf_wait_btcpay", numberWithCommas(normalizeQuantity(data['backward_quantity'])), getAddressLabel(data['tx1_address']));
    }

  } else {
    desc = i18n.t("pend_or_unconf_unhandled");
  }

  desc = desc.replace(/<Am>/g, '<b class="notoQuantityColor">').replace(/<\/Am>/g, '</b>');
  desc = desc.replace(/<Ad>/g, '<b class="notoAddrColor">').replace(/<\/Ad>/g, '</b>');
  desc = desc.replace(/<As>/g, '<b class="notoAssetColor">').replace(/<\/As>/g, '</b>');
  return desc;
}


function PendingActionFeedViewModel() {
  var self = this;
  self.entries = ko.observableArray([]);
  self.lastUpdated = ko.observable(new Date());
  self.ALLOWED_CATEGORIES = [
    'sends', 'orders', 'issuances', 'broadcasts', 'bets', 'dividends', 'burns', 'cancels', 'btcpays', 'order_matches'
  ];
  
  self.dispCount = ko.computed(function() {
    return self.entries().length;
  }, self);

  self.getLocalStorageKey = function() {
    return 'pendingActions_' + WALLET.identifier();
  }

  self.add = function(txHash, category, data, when) {
    if(typeof(when)==='undefined') when = new Date();
    assert(self.ALLOWED_CATEGORIES.indexOf(category)!=-1, "Illegal pending action category: " + category);

    var pendingAction = new PendingActionViewModel(txHash, category, data, when);
    if(!pendingAction.ACTION_TEXT) return; //not something we need to display and/or add to the list
    self.entries.unshift(pendingAction); //place at top (i.e. newest at top)
    $.jqlog.debug("pendingAction:add:" + txHash + ":" + category + ": " + JSON.stringify(data));

    //Add to local storage so we can reload it if the user logs out and back in
    var pendingActionsStorage = localStorage.getObject(self.getLocalStorageKey());
    if(pendingActionsStorage === null) pendingActionsStorage = [];
    pendingActionsStorage.unshift({
      'txHash': txHash,
      'category': category,
      'data': data,
      'when': when
    });
    localStorage.setObject(self.getLocalStorageKey(), pendingActionsStorage);

    self.lastUpdated(new Date());
    PendingActionFeedViewModel.modifyBalancePendingFlag(category, data, true);
    WALLET.refreshBTCBalances();
  }

  self.remove = function(txHash, category, btcRefreshSpecialLogic) {
    if(typeof(btcRefreshSpecialLogic)==='undefined') btcRefreshSpecialLogic = false;
    if(!txHash) return; //if the event doesn't have an txHash, we can't do much about that. :)
    if(self.ALLOWED_CATEGORIES.indexOf(category)==-1) return; //ignore this category as we don't handle it
    var match = ko.utils.arrayFirst(self.entries(), function(item) {
      return item.TX_HASH == txHash;
      //item.CATEGORY == category
    });
    if(match) {
      if(btcRefreshSpecialLogic) {
        assert(category == "sends");
        if (match['CATEGORY'] != category || match['DATA']['asset'] != 'ENRG')
          return;
        //Also, with this logic, since we found the entry as a pending action, add a completed send action
        // to the notifications feed (yes, this is a bit hackish)
        NOTIFICATION_FEED.add("sends", match['DATA']);
      }

      self.entries.remove(match);
      $.jqlog.debug("pendingAction:remove:" + txHash + ":" + category);
      self.lastUpdated(new Date());
      PendingActionFeedViewModel.modifyBalancePendingFlag(category, match['DATA'], false);
    } else{
      $.jqlog.debug("pendingAction:NOT FOUND:" + txHash + ":" + category);
    }

    //Remove from local storage as well (if present)
    var pendingActionsStorage = localStorage.getObject(self.getLocalStorageKey());
    if(pendingActionsStorage === null) pendingActionsStorage = [];
    pendingActionsStorage = pendingActionsStorage.filter(function(item) {
        return item['txHash'] !== txHash;
    }); 
    localStorage.setObject(self.getLocalStorageKey(), pendingActionsStorage);
  }
  
  self.restoreFromLocalStorage = function(onSuccess) {
    //restore the list of any pending transactions from local storage (removing those entries for txns that have been confirmed)
    var pendingActionsStorage = localStorage.getObject(self.getLocalStorageKey());
    var txHashes = [], i = null;
    if(pendingActionsStorage === null) pendingActionsStorage = [];
    for(var i=0; i < pendingActionsStorage.length; i++) {
      if (pendingActionsStorage[i]['txHash'].length==64) {
        txHashes.push(pendingActionsStorage[i]['txHash']);
      }
    }
    if(!txHashes.length) return onSuccess ? onSuccess() : null;

    //construct a new pending info storage object that doesn't include any hashes that we get no data back on
    var newPendingActionsStorage = [], pendingAction = null;
    failoverAPI("get_chain_txns_status", {'txn_hashes': txHashes}, function(txInfo, endpoint) {
      for(i=0; i < txInfo.length; i++) {
        pendingAction = $.grep(pendingActionsStorage, function(e) { return e['txHash'] == txInfo[i]['tx_hash']; })[0];
        if(pendingAction && txInfo[i]['confirmations'] == 0) { //still pending
          $.jqlog.debug("pendingAction:restoreFromStorage:load: " + txInfo[i]['tx_hash'] + ":" + pendingAction['category']);
          newPendingActionsStorage.push(pendingAction);
          self.add(txInfo[i]['tx_hash'], pendingAction['category'], pendingAction['data'], Date.parse(pendingAction['when']));
        } else {
          //otherwise, do not load into pending actions, and do not include in updated pending actions list
          $.jqlog.debug("pendingAction:restoreFromStorage:remove: " + txInfo[i]['tx_hash']);
        }
        //sort the listing (newest to oldest)
        self.entries.sort(function(left, right) {
          return left.WHEN == right.WHEN ? 0 : (left.WHEN < right.WHEN ? 1 : -1);
        });
      }
      localStorage.setObject(self.getLocalStorageKey(), newPendingActionsStorage);
      if(onSuccess) onSuccess();
    });
  }
}
PendingActionFeedViewModel.modifyBalancePendingFlag = function(category, data, flagSetting) {
  assert(flagSetting === true || flagSetting === false);

  var updateAssetObj = function(assetObj, quantity, dividend) {
    assetObj.balanceChangePending(flagSetting);

    if (dividend=='source') {
      quantity = quantity * assetObj.holdersSupply * -1;
    } else if (dividend=='destination') {
      quantity = quantity * assetObj.rawBalance;
    }

    var newUnconfirmedBalance = normalizeQuantity(quantity, assetObj.DIVISIBLE);

    if (flagSetting) {
      assetObj.unconfirmedBalance(assetObj.unconfirmedBalance() + newUnconfirmedBalance);
    } else {
      assetObj.unconfirmedBalance(assetObj.unconfirmedBalance() - newUnconfirmedBalance);
    } 
  }

  var updateUnconfirmedBalance = function(address, asset, quantity, dividend, assetInfo) {

    var addrObj = WALLET.getAddressObj(address);
    if (addrObj) {
      var assetObj = addrObj.getAssetObj(asset);
      if (!assetObj && flagSetting) {
        if (assetInfo) {
          addrObj.addOrUpdateAsset(asset, assetInfo, 0);
          assetObj = addrObj.getAssetObj(asset);
          updateAssetObj(assetObj, quantity, dividend);
        } else {
          failoverAPI("get_asset_info", {'assets': [asset]}, function(assetsInfo, endpoint) {
            addrObj.addOrUpdateAsset(asset, assetsInfo[0], 0);
            assetObj = addrObj.getAssetObj(asset);
            updateAssetObj(assetObj, quantity, dividend);
          });
        }
      } else if (assetObj) {
        updateAssetObj(assetObj, quantity, dividend);
      }
    }

  }

  var addressObj = null;
  if(category == 'burns') {

    addressObj = WALLET.getAddressObj(data['source']);
    addressObj.getAssetObj("XEP").balanceChangePending(flagSetting);
    updateUnconfirmedBalance(data['source'], "ENRG", data['quantity'] * -1);
    

  } else if(category == 'sends') {

    updateUnconfirmedBalance(data['source'], data['asset'], data['quantity'] * -1);
    updateUnconfirmedBalance(data['destination'], data['asset'], data['quantity']);

  } else if(category == 'issuances' && !data['locked'] && !data['transfer_destination']) {
    addressObj = WALLET.getAddressObj(data['source']);
    var assetObj = addressObj.getAssetObj(data['asset']);
    if(assetObj && assetObj.isMine()) {
      updateUnconfirmedBalance(data['source'], data['asset'], data['quantity']);
    } else if (!assetObj) {
      updateUnconfirmedBalance(data['source'], 'XEP', -ASSET_CREATION_FEE_XCP * UNIT);
    }

  } else if (category == 'dividend') {

    updateUnconfirmedBalance(data['source'], data['dividend_asset'], data['quantity_per_unit'], 'source');
    updateUnconfirmedBalance(data['destination'], data['dividend_asset'], data['quantity_per_unit'], 'destination');

  } else if (category == 'orders') {

    if (data['give_asset'] != 'ENRG') {
      updateUnconfirmedBalance(data['source'], data['give_asset'], data['give_quantity'] * -1);
    }   

  } else if (category == 'bets') {

    updateUnconfirmedBalance(data['source'], 'XEP', data['wager_quantity'] * -1);
    
  }
}

/*NOTE: Any code here is only triggered the first time the page is visited. Put JS that needs to run on the
  first load and subsequent ajax page switches in the .html <script> tag*/