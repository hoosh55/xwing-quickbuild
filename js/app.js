angular.module('QuickBuildApp', ['ngMaterial', 'ngMessages'])
.config(function($mdThemingProvider) {
  $mdThemingProvider.theme("default")
    .primaryPalette("red")
    .accentPalette("red");
})

.controller("QuickBuildCtrl", function appCtrl($scope, $http, $q, $timeout, $mdPanel, $mdDialog) {
  $scope.currentList = [];
  $scope.currentListIDs = [];
  $scope.totalThreat = 0;
  $scope.selectedFaction = {};
  $scope.selectedShips = [];
  $scope.allCards = [];

  function init() {
    //var vendorDir = "https://raw.githubusercontent.com/guidokessels/xwing-data2/master/";
    var vendorDir = "./vendor/xwing-data2/"
    loadJSON(vendorDir, "data/manifest.json").then(function(res) {
      var manifest = res.data;
      $scope.data = {
        "upgrades":[],
        "pilots":[],
        "ships":[],
        "factions":[],
        "quickBuilds":[]
      };
      //load upgrades
      for (var upgradePath of manifest.upgrades) {
        loadJSON(vendorDir, upgradePath).then(function(res){
          for (var upgrade of res.data) {
            upgrade.type = xwsParse(fileNameParse(res.fileName));
            $scope.data.upgrades.push(upgrade);
          }
        }, function(reason) {
          alert('Failed: ' + reason);
        });
      }
      //load ships
      for (var faction of manifest.pilots) {
        for (var shipPath of faction.ships) {
          loadJSON(vendorDir, shipPath, faction.faction).then(function(res){
            var ship_xws = xwsParse(fileNameParse(res.fileName));
            res.data.faction = res.faction;
            $scope.data.ships.push(res.data)
            for (var pilot of res.data.pilots) {
              pilot.faction_xws = res.faction;
              pilot.ship = res.data;
              pilot.ship.xws = ship_xws;
              $scope.data.pilots.push(pilot);
            }
          }, function(reason) {
            alert('Failed: ' + reason);
          });
        }
      }
      //load factions
      for (var faction of manifest.factions) {
        loadJSON(vendorDir, faction).then(function(res){
          $scope.data.factions = res.data;
        });
      }
      //load quickbuilds
      var quickBuilds = [];
      for (var quickbuildPath of manifest["quick-builds"]){
        loadJSON(vendorDir, quickbuildPath).then(function(res){
          for (var build of res.data['quick-builds']) {
            build.faction = xwsParse(fileNameParse(res.fileName));
            quickBuilds.push(build);
          }
        }, function(reason) {
          alert('Failed: ' + reason);
        });
      }

      $timeout(function() {
        $scope.data.quickBuilds.forEach(function(build, $index){
          var pilotArray = [];
          build.pilots.forEach(function(pilot){
            var upgradeArray = [];
            for (key in pilot.upgrades){
              pilot.upgrades[key].forEach(function(upgrade){
                var upgradeCard = $scope.getUpgrade(upgrade);
                upgradeArray.push(upgradeCard)
              })
            }
            var pilotCard = $scope.getPilot(pilot.id);
            var shipCard = pilotCard.ship;
            if (pilotCard.limited > 0){
              build.unique = true;
            }
            pilotCard.upgrades = upgradeArray;
            pilotArray.push(pilotCard);
          });
          build.pilots = pilotArray;
          build.id = $index;
          build.name = build.pilots[0].name;
          build.ship = build.pilots[0].ship.name;
        });
        $scope.quickBuildOrderChange('id',false)
        $scope.selectFaction($scope.data.factions[1])
        console.log($scope.data)
      }, 5000)
    }, function(reason) {
      alert('Failed: ' + reason);
    });
  }

  $scope.quickBuildOrderChange = function(expression, reverse){
    $scope.quickBuildOrder = {
      'expression':expression,
      'reverse':reverse
    }
  }

  $scope.addBuild = function(build){
    var pilots = [];
    build.pilots.forEach(function(pilot){
      var upgrades = [];
      pilot.upgrades.forEach(function(upgrade){
        upgrades.push({
          'name':upgrade.name,
          'type':upgrade.type,
          'xws':upgrade.xws
        })
      })
      pilots.push({
        'name':pilot.name,
        'pilotXWS':pilot.xws,
        'limited':pilot.limited,
        'ship':pilot.ship.name,
        'shipXWS':pilot.ship.xws,
        'upgrades':upgrades
      });
    })
    $scope.currentList.push({
      'pilots': pilots,
      'threat': build.threat
    });
    $scope.currentListIDs.push(build.id)
    $scope.totalThreat += build.threat;
    console.log($scope.currentList);
  }

  $scope.removeBuild = function(build){
    var buildIndex = $scope.currentList.indexOf(build);
    var buildIDIndex = $scope.currentListIDs.indexOf(build.id);
    $scope.currentList.splice(buildIndex, 1);
    $scope.currentListIDs.splice(buildIDIndex, 1);
    $scope.totalThreat = 0;
    $scope.currentList.forEach(function(build){
      $scope.totalThreat += build.threat;
    })
  }

  $scope.selectFaction = function(faction){
    $scope.selectedFaction = faction;
    $scope.selectedShips = [];
    $scope.data.ships.forEach(function(ship){
      if (ship.faction === faction.xws){
        $scope.selectedShips.push(ship.xws);
      }
    })
    var allCards = [];
    $scope.data.quickBuilds.forEach(function(build){
      if (build.faction === faction.xws){
        build.cards = [];
        build.pilots.forEach(function(pilot){
          build.cards.push(pilot.xws);
          allCards.push({'name':pilot.name,'xws':pilot.xws})
          build.cards.push(pilot.ship.xws);
          allCards.push({'name':pilot.ship.name,'xws':pilot.ship.xws})
          pilot.upgrades.forEach(function(upgrade){
            build.cards.push(upgrade.xws)
            allCards.push({'name':upgrade.name,'xws':upgrade.xws})
          })
        })
      }
    })

    $scope.allCards = UniqueArraybyId(allCards, 'xws')
    console.log('ALL CARDS',$scope.allCards);

  }

  $scope.toggleShip = function(ship, ev){
    ev.preventDefault();
    console.log(ship);
    var shipIndex = $scope.selectedShips.indexOf(ship);
    if (shipIndex > -1){
      $scope.selectedShips.splice(shipIndex, 1);
    } else {
      $scope.selectedShips.push(ship);
    }
  }

  $scope.selectedFilter = function(build){
    var hasShip = false;
    if (build.faction === $scope.selectedFaction.xws){
      build.pilots.forEach(function(pilot){
        if ($scope.selectedShips.indexOf(pilot.ship.xws) > -1){
          //console.log(pilot.ship.xws)
          hasShip = true;
        }
      })
    }
    if (hasShip){
      return build;
    }
  }

  $scope.costFilter = function(build){
    if (!($scope.currentListIDs.indexOf(build.id) > -1 && build.unique) && ($scope.totalThreat + build.threat <= 8)){
      return build;
    }
  }

  $scope.searchFilter = function(build){
    if ($scope.searchCard){
      var card = $scope.searchCard.xws;
      if (build.cards.indexOf(card) > -1){
        return build;
      }
    } else {
      return build;
    }
  }

  $scope.getPilot = function(pilot_xws) {
    for (var s = 0; s < $scope.data.pilots.length; ++s) {
      var pilot = $scope.data.pilots[s];
      if (pilot.xws === pilot_xws) {
        return pilot;
      }
    }
    console.warn("Unknown pilot ", pilot_xws);
    return null;
  }

  $scope.getShip = function(ship_xws) {
    for (var s = 0; s < $scope.data.pilots.length; ++s) {
      var pilot = $scope.data.pilots[s];
      if (pilot.ship.xws === ship_xws ) {
        return pilot.ship;
      }
    }
    console.warn("Unknown pilot ", pilot_xws, ship_xws);
    return null;
  }

  $scope.getUpgrade = function(name) {
    for (var t = 0; t < $scope.data.upgrades.length; ++t) {
      var upgrade = $scope.data.upgrades[t];
      if (upgrade.xws === name) {
        return upgrade;
      }
    }
    console.warn("Unknown upgrade ", name);
    return null;
  }

  function xwsParse(fullname) {
    return fullname.toLowerCase().replace(/[\W]+/g,"");;
  }

  function fileNameParse(path) {
    return path.split(/(\\|\/)/g).pop().replace(".json", "");
  }

  function loadJSON(path, fileName, faction) {
    var deferred = $q.defer();

    $q(function(resolve, reject) {
      $http.get(path + fileName).then(function(res){
        deferred.resolve({'data':res.data,'fileName':fileName, 'faction':faction});
      });
    });

    return deferred.promise;
  }

  $scope.getArray = function(len) {
    return new Array(len);
  }

  $scope.getThreatColor = function(index){
    var colors = ["#71c043","#fff200","#f5811f","#ee1c25","#d70b8b","#994f9f"]
    return colors[index - 1]
  }

  $scope.openMenu = function($mdMenu, ev) {
    originatorEv = ev;
    $mdMenu.open(ev);
  };

  $scope.getIcon = function getIcon(name){
    var iconMap = {
      'rebelalliance':'rebel',
      'galacticempire':'empire',
      'scumandvillainy':'scum',
      'separatistalliance':'separatists',
      'galacticrepublic':'republic',
      'configuration':'config',
      'resistance':'rebel'
    }
    if (iconMap.hasOwnProperty(name)){
      return iconMap[name];
    }
    return name;
  }

  $scope.getSigShip = function getSigShip(faction){
    var iconMap = {
      'rebelalliance':'t65xwing',
      'galacticempire':'tielnfighter',
      'scumandvillainy':'firesprayclasspatrolcraft',
      'resistance':'t70xwing',
      'firstorder':'upsilonclasscommandshuttle',
      'separatistalliance':'',
      'galacticrepublic':'',
    }
    return iconMap[faction];
  }

  $scope.getSelectedText = function() {
    var iconMap = {
      'rebelalliance':'x',
      'galacticempire':'F',
      'scumandvillainy':'f',
      'resistance':'w',
      'firstorder':'U',
      'separatistalliance':'',
      'galacticrepublic':'',
    }
    return iconMap[$scope.selectedFaction.xws];
  };

  $scope.querySearch = function querySearch (query) {
    var results = query ? $scope.allCards.filter(createFilterFor(query)) : []
    return results;
  }

  $scope.searchTextChange = function searchTextChange(text) {
    //console.log('Text changed to ' + text);
  }

  $scope.searchCardChange = function searchCardChange(item) {
    //console.log('Item changed to ' + JSON.stringify(item));
  }

  function createFilterFor(query) {
    var lowercaseQuery = query.toLowerCase();

    return function filterFn(card) {
      return (card.name.toLowerCase().indexOf(lowercaseQuery) > -1);
    };
  }

  function UniqueArraybyId(collection, keyname) {
    var output = [],
        keys = [];

    angular.forEach(collection, function(item) {
        var key = item[keyname];
        if(keys.indexOf(key) === -1) {
            keys.push(key);
            output.push(item);
        }
    });
    return output;
  };

  $scope.showMenu = function(ev, card) {
    var position = $mdPanel.newPanelPosition()
        .relativeTo(ev.srcElement)
        .addPanelPosition($mdPanel.xPosition.ALIGN_START, $mdPanel.yPosition.BELOW);

      console.log(card);

      var template = '';
      if (card.sides){
        card.sides.forEach(function(side){
          template += '<div><img style="max-width: 400px;" src="' + side.image + '" /></div>';
        })
      } else {
        console.log('no sides')
        template += '<div><img style="max-width: 300px;" src="' + card.image + '" /></div>';
      }

    var config = {
      attachTo: angular.element(document.body),
      controller: cardPanelCtrl,
      controllerAs: 'ctrl',
      template: template,
      panelClass: '',
      position: position,
      openFrom: ev,
      clickOutsideToClose: true,
      escapeToClose: true,
      focusOnOpen: false,
      zIndex: 2,
      disableParentScroll: false
    };

    $mdPanel.open(config);
  };

  function cardPanelCtrl(mdPanelRef, $timeout) {
    $mdPanelRef = mdPanelRef;
  }

  $scope.showCard = function showCard($event, card) {
    var template = '<md-dialog style="background: none;">';
    if (card.sides){
      card.sides.forEach(function(side){
        template += '<div><img style="max-width: 400px;" src="' + side.image + '" /></div>';
      })
    } else {
      template += '<div><img style="max-width: 300px;" src="' + card.image + '" /></div>';
    }
    template += '</md-dialog>'

    $mdDialog.show({
      parent: angular.element(document.body),
      targetEvent: $event,
      template: template,
      locals: {
        card: card
      },
      clickOutsideToClose: true,
      escapeToClose: true,
      controller: CardDialogController
    });
    function CardDialogController($scope, $mdDialog, card) {
      $scope.card = card;
      $scope.closeDialog = function() {
        $mdDialog.hide();
      }
    }
  }

  $scope.showList = function showList($event){
    $mdDialog.show({
      parent: angular.element(document.body),
      targetEvent: $event,
      templateUrl: './dialog/list.html',
      locals: {
        currentList: $scope.currentList
      },
      clickOutsideToClose: true,
      escapeToClose: true,
      controller: ListDialogController
    });
    function ListDialogController($scope, $mdDialog, currentList) {
      $scope.currentList = currentList;

      $scope.getArray = function(len) {
        return new Array(len);
      }

      $scope.getThreatColor = function(index){
        var colors = ["#71c043","#fff200","#f5811f","#ee1c25","#d70b8b","#994f9f"]
        return colors[index - 1]
      }

      $scope.getIcon = function getIcon(name){
        var iconMap = {
          'rebelalliance':'rebel',
          'galacticempire':'empire',
          'scumandvillainy':'scum',
          'separatistalliance':'separatists',
          'galacticrepublic':'republic',
          'configuration':'config',
          'resistance':'rebel'
        }
        if (iconMap.hasOwnProperty(name)){
          return iconMap[name];
        }
        return name;
      }

      $scope.closeDialog = function() {
        $mdDialog.hide();
      }
    }
  }

  init();
})
