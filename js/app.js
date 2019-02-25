angular.module('QuickBuildApp', ['ngMaterial', 'ngMessages'])
.config(function($mdThemingProvider) {
  $mdThemingProvider.theme("default")
    .primaryPalette("blue")
    .accentPalette("blue");
})

.controller("QuickBuildCtrl", function appCtrl($scope, $http, $q, $timeout, $mdPanel) {
  $scope.currentBuild = [];
  $scope.currentBuildIDs = [];
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
      for (var quickbuildPath of manifest["quick-builds"]){
        loadJSON(vendorDir, quickbuildPath).then(function(res){
          for (var build of res.data['quick-builds']) {
            build.faction = xwsParse(fileNameParse(res.fileName));
            $scope.data.quickBuilds.push(build);
          }
        }, function(reason) {
          alert('Failed: ' + reason);
        });
      }

      $timeout(function() {
        $scope.data.quickBuilds.forEach(function(build, $index){
          build.id = $index;
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
        });
        $scope.selectFaction($scope.data.factions[0])
        console.log($scope.data)
      }, 5000)
    }, function(reason) {
      alert('Failed: ' + reason);
    });
  }

  $scope.addBuild = function(build){
    $scope.currentBuild.push(build);
    $scope.currentBuildIDs.push(build.id)
    $scope.totalThreat = 0;
    $scope.currentBuild.forEach(function(build){
      $scope.totalThreat += build.threat;
    })
  }

  $scope.removeBuild = function(build){
    var buildIndex = $scope.currentBuild.indexOf(build);
    var buildIDIndex = $scope.currentBuildIDs.indexOf(build.id);
    $scope.currentBuild.splice(buildIndex, 1);
    $scope.currentBuildIDs.splice(buildIDIndex, 1);
    $scope.totalThreat = 0;
    $scope.currentBuild.forEach(function(build){
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
    var shipIndex = $scope.selectedShips.indexOf(ship);
    if (shipIndex > -1){
      $scope.selectedShips.splice(shipIndex, 1);
    } else {
      $scope.selectedShips.push(ship);
    }
  }

  $scope.selectedFilter = function(build){
    var filterBuild = true;
    if (build.faction === $scope.selectedFaction.xws){
      build.pilots.forEach(function(pilot){
        if ($scope.selectedShips.indexOf(pilot.ship.xws) > -1){
          filterBuild = false;
        }
      })
    }
    if (!filterBuild){
      return build;
    }
  }

  $scope.costFilter = function(build){
    if (!($scope.currentBuildIDs.indexOf(build.id) > -1 && build.unique) && ($scope.totalThreat + build.threat <= 8)){
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
    var colors = ["#4CAF50","#FFEB3B","#FF9800","#F44336","#E91E63","#9C27B0"]
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
            template += '<div><img style="max-width: 350px;" src="' + side.image + '" /></div>';
          })
        } else {
          console.log('no sides')
          template += '<div><img style="max-width: 350px;" src="' + card.image + '" /></div>';
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

  init();
})
