Components.utils.import("resource://gre/modules/AddonManager.jsm");
var PromptService = Components.classes["@mozilla.org/embedcomp/prompt-service;1"].getService(Components.interfaces.nsIPromptService);

SiteFusion.Login = {

	argsAppUrl: null,
	argsUsername: null,
	argsPassword: null,

	Fields: [
		'address',
		'application',
		'arguments',
		'username',
		'password'
	],
	
	Listeners: [],
	DownloadExtensions: [],
	
	SetListener: function( listener ) {
		this.Listeners.push( listener );
	},
	
	extensionInfo: {},
	
	ParseCommandLineArguments: function(args) {
		if(args != null) {
			args = new String(args);
			var idxOfXulQ = args.indexOf('.xul?');
			if(idxOfXulQ != -1) {
			    var query = args.substr(idxOfXulQ + 5);
			    var parts = query.split("&");
			    for(var i = 0; i < parts.length; i++) {
			        var part = parts[i];
			        var qPart = part.indexOf('=');
			        if(qPart != -1) {
			            var key = part.substr(0, qPart);
			            var value = unescape(part.substr(qPart+1));
			            
			            if(key == 'appUrl')
			                this.argsAppUrl = value;
			            else if (key == 'username')
			                this.argsUsername = value;
			            else if (key == 'password')
			                this.argsPassword = value;
			        }
			    }
			}
		}
	},

	Init: function(startupLocation) {
		SiteFusion.ImportErrors();
		if (startupLocation) {
			SiteFusion.Login.ParseCommandLineArguments(startupLocation); 
		}
		var oThis = this;
		AddonManager.getAllAddons(function(aAddons) {
			
			var details = {};
			
			aAddons.forEach(function(addon) {
				
				oThis.extensionInfo[addon.id] = {
					name: addon.name,
					version: addon.version,
					userDisabled: addon.userDisabled,
					enabled: ((!addon.userDisabled && !addon.appDisabled) ? true : false),
					isActive: addon.isActive,
					isCompatible: addon.isCompatible,
					installLocationKey: addon.scope,
					isPlatformCompatible: addon.isPlatformCompatible,
					providesUpdatesSecurely: addon.providesUpdatesSecurely,
					scope: addon.scope,
					type: addon.type,
					userDisabled: addon.userDisabled,
					aboutURL: addon.aboutURL,
					description: addon.description,
					homepageURL: addon.homepageURL,
					iconURL: addon.iconURL,
					installDate: (addon.installDate ? addon.installDate.toString() : ''),
					optionsURL: addon.optionsURL,
					size: addon.size,
					sourceURI: (addon.sourceURI) ? addon.sourceURI.spec : '',
					updateDate: (addon.updateDate ? addon.updateDate.toString() : '')
				};
			});
			//this has to be done after loading the extensionlist, because it depends on it
			
			var prefs = Components.classes["@mozilla.org/preferences-service;1"].getService(Ci.nsIPrefBranch);
			var autoLogin = true;
			var focusElement = null;
			
			for( var n = 0; n < oThis.Fields.length; n++ ) {
				var field = oThis.Fields[n];
				var value = null;
				var forced = false;
				
				if( prefs.getPrefType("sitefusion.forceLogin."+field) == prefs.PREF_STRING ) {
					value = prefs.getCharPref( "sitefusion.forceLogin."+field );
					forced = true;
				}
				else if( prefs.getPrefType("sitefusion.lastLogin."+field) == prefs.PREF_STRING ) {
					value = prefs.getCharPref( "sitefusion.lastLogin."+field );
					forced = false;
				}
				
				details[field] = { 'value': value, 'forced': forced };
			}
			
			setTimeout(function() {
				//first check for autologin based on preferences.
				if(prefs.getPrefType("sitefusion.autoLogin.enabled") == prefs.PREF_BOOL && prefs.getBoolPref("sitefusion.autoLogin.enabled") ) {
					prefs.setBoolPref( "sitefusion.autoLogin.enabled", false );
					var address = prefs.getCharPref( "sitefusion.autoLogin.address" );
					prefs.setCharPref( "sitefusion.autoLogin.address", "" );
					var application = prefs.getCharPref( "sitefusion.autoLogin.application" );
					prefs.setCharPref( "sitefusion.autoLogin.application", "" );
					var args = prefs.getCharPref( "sitefusion.autoLogin.arguments" );
					prefs.setCharPref( "sitefusion.autoLogin.arguments", "" );
					var username = prefs.getCharPref( "sitefusion.autoLogin.username" );
					prefs.setCharPref( "sitefusion.autoLogin.username", "" );
					var password = prefs.getCharPref( "sitefusion.autoLogin.password" );
					prefs.setCharPref( "sitefusion.autoLogin.password", "" );
					
					SiteFusion.Login.OnLogin( address, application, args, username, password, false );
				}
				else if (oThis.argsAppUrl && oThis.argsUsername && oThis.argsPassword) {
					var ret = SiteFusion.ParseUri(oThis.argsAppUrl);
					if(ret['protocol'] && ret['user'] && ret['host']) {
							var proto = ret['protocol']
							if (proto == 'sf')
								proto = "http";
							else if (proto == 'sfs')
								proto = "https";
								

							var uri = proto + "://" + ret['host'] + ((ret['port']) ? ":" + ret['port'] : "") + ret['path'];
							SiteFusion.Login.OnLogin( uri, ret['user'], ret['password'], oThis.argsUsername, oThis.argsPassword, false );
					}
				}
			},500);
		
		
			for( var n = 0; n < oThis.Listeners.length; n++ ) {
					oThis.Listeners[n].onInit( details );
			}
				
		});
	},
	
	OnClose: function(keepLoginDetails) {
		for( var n = 0; n < this.Listeners.length; n++ ) {
			this.Listeners[n].onClose();
		}

		if (!keepLoginDetails) {
			this.ForgetLoginDetails();
		}
		window.close();
	},
	
	ForgetLoginDetails: function() {
		var prefs = Components.classes["@mozilla.org/preferences-service;1"].getService(Ci.nsIPrefBranch);
		//don't save details? Clean them up!
		prefs.setCharPref( "sitefusion.lastLogin.username",  '' );
		prefs.setCharPref( "sitefusion.lastLogin.password", '' );

		for( var n = 0; n < this.Listeners.length; n++ ) {
			this.Listeners[n].onForgetLoginDetails();
		}
	},
	
	OnLogin: function( address, application, args, username, password, rememberDetails ) {
		for( var n = 0; n < this.Listeners.length; n++ ) {
			this.Listeners[n].onLogin( { 'address': address, 'application': application, 'arguments': args, 'username': username, 'password': password } );
		}
		
		if( rememberDetails ) {
			var prefs = Components.classes["@mozilla.org/preferences-service;1"].getService(Ci.nsIPrefBranch);
			
			prefs.setCharPref( "sitefusion.lastLogin.address", address + '' );
			prefs.setCharPref( "sitefusion.lastLogin.application", application + '' );
			prefs.setCharPref( "sitefusion.lastLogin.arguments", args + '' );
			prefs.setCharPref( "sitefusion.lastLogin.username", username + '' );
			prefs.setCharPref( "sitefusion.lastLogin.password", password + '' );
		}
		else {
			this.ForgetLoginDetails();
		}
		
		SiteFusion.ClientID = SiteFusion.GetRandomQuery();
        SiteFusion.FatalErrorOccurred = false;
        var serverAddressParts = SiteFusion.ParseUri(address);
		var serverHost = serverAddressParts.host;
        
        var DNSResolver = Components.classes["@mozilla.org/network/dns-service;1"].getService(Components.interfaces.nsIDNSService );
		
		for( var n = 0; n < this.Listeners.length; n++ ) {
			this.Listeners[n].onProgress( SiteFusion.Login.ProgressListener.STAGE_NSLOOKUP_START, null, null, SFStringBundleObj.GetStringFromName('resolvingServerAddress') + ": " + serverHost );
		}
		
        try {
            var dns = DNSResolver.resolve(serverHost,4);
            var serverIp = dns.getNextAddrAsString();
        }
        catch (e) {
        	for( var n = 0; n < this.Listeners.length; n++ ) {
				this.Listeners[n].onFinish( false, SiteFusion.Login.ProgressListener.ERROR_NSLOOKUP_FAILED, SFStringBundleObj.GetStringFromName("short_cantConnect") );
			}
			SiteFusion.HandleError( { 'error': true, 'type': 'server_offline', 'message': 'Cant resolve hostaddress ' + serverHost  } );
			return false;
        }
		
		for( var n = 0; n < this.Listeners.length; n++ ) {
			this.Listeners[n].onProgress( SiteFusion.Login.ProgressListener.STAGE_NSLOOKUP_COMPLETE, null, null, SFStringBundleObj.GetStringFromName("serverAdressResolved") + ": " + serverIp );
		}
		
		var x = new XMLHttpRequest;
		try {
			for( var n = 0; n < this.Listeners.length; n++ ) {
				this.Listeners[n].onProgress( SiteFusion.Login.ProgressListener.STAGE_CONNECT_START, null, null, SFStringBundleObj.GetStringFromName("connectingTo") + ": " + address );
			}

			var platformInfo = {
				appCodeName: navigator.appCodeName,
				appName: navigator.appName,
				appVersion: navigator.appVersion,
				buildID: navigator.buildID,
				language: navigator.language,
				oscpu: navigator.oscpu,
				platform: navigator.platform,
				vendor: navigator.vendor,
				vendorSub: navigator.vendorSub
			};

			var appInfoObj = Cc["@mozilla.org/xre/app-info;1"].getService(Ci.nsIXULAppInfo);
			var appInfo = {
				vendor: appInfoObj.vendor,
				name: appInfoObj.name,
				ID: appInfoObj.ID,
				version: appInfoObj.version,
				appBuildID: appInfoObj.appBuildID,
				platformVersion: appInfoObj.platformVersion,
				platformBuildID: appInfoObj.platformBuildID
			};
			
			SiteFusion.Version = appInfo.version;

			var cmdlineArgs = {};
			var query = location.search.substr(1);

			if( query.length ) {
				var cmdline = query.split('&');
				for( var n = 0; n < cmdline.length; n++ ) {
					var arg = cmdline[n].split('=');
					cmdlineArgs[arg[0]] = (arg[1] == 'true' ? true:arg[1]);
				}
			}
			
			var postAddress = address + '/login.php?app=' + application + '&args=' + args + '&clientid=' + SiteFusion.ClientID;
			x.open( 'POST', postAddress, true );
			var oThis = this;
			x.onreadystatechange=function() {
			  if(x.readyState==4) {
				  	if( x.status != 200 ) {
						for( var n = 0; n < oThis.Listeners.length; n++ ) {
							oThis.Listeners[n].onFinish( false, SiteFusion.Login.ProgressListener.ERROR_SERVER_DOWN, SFStringBundleObj.GetStringFromName("short_cantConnect") );
						}
						
						SiteFusion.HandleError( { 'error': true, 'type': 'server_offline', 'message': 'Server ' + address + ' returned response code ' + x.status + ' payload: ' + x.responseText} );
						return false;
					}
					else {
						oThis.afterLogin(x,address, application, args, username, password, rememberDetails);
					}
				}
			};
			x.setRequestHeader( 'Content-Type', 'sitefusion/login' );
			x.send( JSON.stringify( {
				'username': username,
				'password': password,
				'appInfo': appInfo,
				'platformInfo': platformInfo,
				'extensionInfo': SiteFusion.Login.extensionInfo,
				'cmdlineArgs': cmdlineArgs
			} ) );
			return true;
		}
		
		catch(e) {
			for( var n = 0; n < this.Listeners.length; n++ ) {
				this.Listeners[n].onFinish( false, SiteFusion.Login.ProgressListener.ERROR_SERVER_DOWN, SFStringBundleObj.GetStringFromName("short_cantConnect") );
			}
			
			SiteFusion.HandleError( { 'error': true, 'type': 'server_offline', 'message': e } );
			return false;
		}
	},
	
	afterLogin: function(x,address, application, args, username, password, rememberDetails) {
		var result, login;
		if( result = x.getResponseHeader('Content-Type').match( /sitefusion\/(result|error)/ ) ) {
			if( result[1] == 'error' ) {
				for( var n = 0; n < this.Listeners.length; n++ ) {
					this.Listeners[n].onFinish( false, SiteFusion.Login.ProgressListener.ERROR_LOGIN_INVALID, SFStringBundleObj.GetStringFromName("short_cantConnect") );
				}
				SiteFusion.HandleError( eval( "(" + x.responseText + ")\n\n//# sourceURL=sitefusion-eval-login.js" ) );
				
				return false;
			}
			
			login = eval( "(" + x.responseText + ")\n\n//# sourceURL=sitefusion-eval-login.js" );
		}
		else {
			for( var n = 0; n < this.Listeners.length; n++ ) {
				this.Listeners[n].onFinish( false, SiteFusion.Login.ProgressListener.ERROR_SERVER_INVALID, SFStringBundleObj.GetStringFromName("short_cantConnect") );
			}
			
			SiteFusion.HandleError( { 'error': true, 'type': 'server_invalid', 'message': x.responseText } );
			return false;
		}
		
		for( var n = 0; n < this.Listeners.length; n++ ) {
			this.Listeners[n].onProgress( SiteFusion.Login.ProgressListener.STAGE_CONNECT_COMPLETE, null, null, null );
		}
		
		SiteFusion.Address = address;
		SiteFusion.Application = application;
		SiteFusion.Arguments = args;
		SiteFusion.Username = username;
		SiteFusion.Ident = login.ident;
		SiteFusion.SID = login.sid;
		SiteFusion.RemoteLibraries = login.includeJs.split(',');
		SiteFusion.ExtensionPolicy = login.extensionPolicy ? login.extensionPolicy : {};
		
		
		for( var n = 0; n < this.Listeners.length; n++ ) {
			this.Listeners[n].onProgress( SiteFusion.Login.ProgressListener.STAGE_LOADING_START, 0, null, null );
		}
		
		var restartRequired = false;
		if (login.extensionPolicy.length) {
			for ( var n = 0; n < login.extensionPolicy.length; n++ ) {
				var id = login.extensionPolicy[n][0];
				var action = login.extensionPolicy[n][1];
				
				switch ( action ) {
					case 'enable':
						if( SiteFusion.Login.extensionInfo[id].userDisabled ) {
							restartRequired = true;
							AddonManager.getAddonByID(
							  id,
							  function(addon) {
							  	addon.userDisabled = false;
							  	delete login.extensionPolicy.shift();
							  	if (!login.extensionPolicy.length) {
							  		SiteFusion.Login.StoreCredentialsAndRestart(address, application, SiteFusion.Arguments, username, password);
							  	}
							  }
							);
						}
					break;
					case 'disable':
						if( !SiteFusion.Login.extensionInfo[id].userDisabled ) {
							restartRequired = true;
							AddonManager.getAddonByID(
						  	  id,
						  	  function(addon) {
								addon.userDisabled = true;
								login.extensionPolicy.shift();
								
							  	if (!login.extensionPolicy.length) {
							  		SiteFusion.Login.StoreCredentialsAndRestart(address, application, SiteFusion.Arguments, username, password);
						  		}
							  }
							);
							
						}
					break;
					case 'get':
						SiteFusion.Login.DownloadExtensions.push( login.extensionPolicy[n][2] );
						login.extensionPolicy.shift();
					break;
				}
			}
			
			if( SiteFusion.Login.DownloadExtensions.length ) {
				this.StoreCredentialsAndRestart(address, application, SiteFusion.Arguments, username, password);
				return;
			}	
			else if (restartRequired) return;
		}
		
		SiteFusion.Login.GetLibraries(login);
	},

	StoreCredentialsAndRestart: function (address, application, args, username, password) {
		var prefs = Components.classes["@mozilla.org/preferences-service;1"].getService(Ci.nsIPrefBranch);
			prefs.setBoolPref( "sitefusion.autoLogin.enabled", true );
			prefs.setCharPref( "sitefusion.autoLogin.address", address + '' );
			prefs.setCharPref( "sitefusion.autoLogin.application", application + '' );
			prefs.setCharPref( "sitefusion.autoLogin.arguments", args + '' );
			prefs.setCharPref( "sitefusion.autoLogin.username", username + '' );
			prefs.setCharPref( "sitefusion.autoLogin.password", password + '' );
			
			
			if( SiteFusion.Login.DownloadExtensions.length ) {
				var fileName = SiteFusion.Login.DownloadExtensions.shift();
				var destPath = SiteFusion.Login.GetDownloadLocation( fileName );
				SiteFusion.Login.DownloadExtension( fileName, destPath );
			}
			else {
				SiteFusion.Login.RestartApp();
			}	
	},
	
	OnExtensionDownloadProgress: function( listener, id, progress ) {
		if( listener.done ) {
			if( SiteFusion.Login.DownloadExtensions.length ) {
				var id = SiteFusion.Login.DownloadExtensions.shift();
				var file = SiteFusion.Login.GetDownloadLocation( id );
				SiteFusion.Login.DownloadExtension( id, file );
				return;
			}
			else {
				SiteFusion.Login.RestartApp();
			}
		}
		
		for( var l = 0; l < SiteFusion.Login.Listeners.length; l++ ) {
			SiteFusion.Login.Listeners[l].onProgress( SiteFusion.Login.ProgressListener.STAGE_LOADING, progress * 100, id, SFStringBundleObj.GetStringFromName("loadingLibrary") + ': ' + id );
		}
	},
	
	GetDownloadLocation: function( file ) {
		var profD = Cc["@mozilla.org/file/directory_service;1"].getService(Ci.nsIProperties).get("ProfD", Ci.nsIFile);
		
		var extDir = profD.parent;
		extDir = extDir.parent;
		extDir.append('sitefusion-install-extensions');
		if( !extDir.exists() || !extDir.isDirectory() ) {
			extDir.create(Ci.nsIFile.DIRECTORY_TYPE, 0755);
		}
		extDir.append(file);
		return extDir;
	},
	
	DownloadExtension: function( id, path ) {
		var progressListener = {
			stateIsRequest:false,
			done: false,
	        QueryInterface : function(aIID) {
	            if (aIID.equals(Components.interfaces.nsIWebProgressListener) ||
	                aIID.equals(Components.interfaces.nsISupportsWeakReference) ||
	                aIID.equals(Components.interfaces.nsISupports))
	                    return this;
	            throw Components.results.NS_NOINTERFACE;
	        },
			onStateChange: function( webProgress, request, stateFlags, status ) {},
			onProgressChange: function( webProgress, request, curSelfProgress, maxSelfProgress, curTotalProgress, maxTotalProgress ) {
				if( curSelfProgress == maxSelfProgress )
					this.done = true;
				SiteFusion.Login.OnExtensionDownloadProgress( this, this.extensionId, curSelfProgress/maxSelfProgress );
			},
			onLocationChange: function( webProgress, request, location ) {},
			onStatusChange: function( webProgress, request, status, message ) {},
			onSecurityChange: function( webProgress, request, state ) {}
		};
		
		progressListener.extensionId = id;
		
		var httpLoc = SiteFusion.Address + '/getextension.php?app=' + SiteFusion.Application + '&args=' + SiteFusion.Arguments + '&sid=' + SiteFusion.SID + '&ident=' + SiteFusion.Ident + '&extension=' + escape(id);
		
		try {
			//new obj_URI object
			var url = Cc["@mozilla.org/network/io-service;1"].getService(Ci.nsIIOService).newURI(httpLoc, null, null);
	
			//if file doesn't exist, create
			if(!path.exists()) {
				path.create(0x00,0644);
			}
			//new persitence object
			var persist = Cc["@mozilla.org/embedding/browser/nsWebBrowserPersist;1"].createInstance(Ci.nsIWebBrowserPersist);
			
			//save file to target
			persist.progressListener = progressListener;
			var nsIWBP = Ci.nsIWebBrowserPersist;

			persist.persistFlags = nsIWBP.PERSIST_FLAGS_REPLACE_EXISTING_FILES |
			            nsIWBP.PERSIST_FLAGS_BYPASS_CACHE |
			            nsIWBP.PERSIST_FLAGS_FAIL_ON_BROKEN_LINKS |
			            nsIWBP.PERSIST_FLAGS_CLEANUP_ON_FAILURE;
			
			var privacyContext = window.QueryInterface(Components.interfaces.nsIInterfaceRequestor)
			.getInterface(Components.interfaces.nsIWebNavigation)
			.QueryInterface(Components.interfaces.nsILoadContext);
			
			persist.saveURI(url,null,null,null,null,path,privacyContext);
			
			return progressListener;
			
		} catch (e) {
			SiteFusion.Error(e);
		}
	},
	
	RestartApp: function() {
		var flags = 0;
		var os = Components.classes["@mozilla.org/observer-service;1"]
			.getService(Components.interfaces.nsIObserverService);
		var cancelQuit = Components.classes["@mozilla.org/supports-PRBool;1"]
			.createInstance(Components.interfaces.nsISupportsPRBool);
		os.notifyObservers(cancelQuit, "quit-application-requested", "restart");

		// Something aborted the quit process.
		if (cancelQuit.data)
			return;

		if( navigator.platform.match(/mac/i)) {
			var targetWindow = window;
	        winUtils = targetWindow.QueryInterface(Components.interfaces.nsIInterfaceRequestor).getInterface(Components.interfaces.nsIDOMWindowUtils);

	        try {
		        if (winUtils && !winUtils.isParentWindowMainWidgetVisible) {
		            targetWindow = null;
		        }
	    	}
	    	catch (e) {
	    		targetWindow = null;
	    	}
			PromptService.alert( targetWindow, SFStringBundleObj.GetStringFromName('restart'), SFStringBundleObj.GetStringFromName('appRequiredManualRestart'));

			flags = Components.interfaces.nsIAppStartup.eAttemptQuit;
		}
		else {
			flags = Components.interfaces.nsIAppStartup.eRestart | Components.interfaces.nsIAppStartup.eAttemptQuit;
		}

		Components.classes["@mozilla.org/toolkit/app-startup;1"]
			.getService(Components.interfaces.nsIAppStartup)
			.quit(flags);
	},
	
	OpenRootWindow: function(flags) {
		var prefs = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefBranch);

		var rootWindow = open( prefs.getCharPref("sitefusion.defaultRootWindowURI")+location.search, '', flags );
		if (document.getElementById('mnuDebugSession').hasAttribute("checked")) {
			rootWindow.addEventListener("load", function(){rootWindow.debugSession();},false);
		}
	},
	
	GetLibraries: function(login) {
		var d = new Date();
		var reqLibCount = SiteFusion.RemoteLibraries.length;
		var curLibCount = 0;
		for (var n = 0; n < reqLibCount; n++) {
			try {
				var libGetter = new XMLHttpRequest;
				libGetter.open('GET', SiteFusion.Address + '/jslibrary.php?name=' + SiteFusion.RemoteLibraries[n] + '&app=' + SiteFusion.Application + '&args=' + SiteFusion.Arguments + '&sid=' + SiteFusion.SID + '&ident=' + SiteFusion.Ident + '&cycle=' + d.getTime(), true);
				libGetter.responseType = 'text';
				libGetter._index = n;
				libGetter._fileName = SiteFusion.RemoteLibraries[n];

				var oThis = this;
				libGetter.onreadystatechange = function() {
			  		if (this.readyState == 4) {
			  			var index = this._index;
			  			var fileName = this._fileName;

			  			if (this.status == 200 ) {
							SiteFusion.LibraryContent[index] = [fileName + '.js', this.responseText];
							curLibCount++;

							for (var l = 0; l < oThis.Listeners.length; l++) {
								oThis.Listeners[l].onProgress(SiteFusion.Login.ProgressListener.STAGE_LOADING, Math.round((curLibCount / reqLibCount) * 100), fileName, SFStringBundleObj.GetStringFromName("loadingLibrary") + ': ' + SiteFusion.RemoteLibraries[index]);
							}

							if (curLibCount == reqLibCount) {
								for (var l = 0; l < oThis.Listeners.length; l++) {
									SiteFusion.Login.Listeners[l].onProgress(SiteFusion.Login.ProgressListener.STAGE_LOADING_COMPLETE, null, null, null);
								}
								
								var flags = 'chrome';
								if (login.alwaysLowered) {
									flags += ',alwaysLowered';
								}

								if (login.alwaysRaised) {
									flags += ',alwaysRaised';
								}

								if (login.centerscreen) {
									flags += ',centerscreen';
								}

								if (login.resizable) {
									flags += ',resizable';
								}

								if (login.width) {
									flags += ',width=' + login.width;
								}

								if (login.height) {
									flags += ',height=' + login.height;
								}

								setTimeout(function() {
									SiteFusion.Login.OpenRootWindow(flags);
									for (var l = 0; l < oThis.Listeners.length; l++) {
										SiteFusion.Login.Listeners[l].onFinish(true, null, null);
									}
								}, 10);
							}
						} else {
							SiteFusion.Error(SFStringBundleObj.GetStringFromName('cantLoadLib') + ": " + fileName);
						}
					}
				}

				libGetter.send(null);
			} catch(e) {
				SiteFusion.Error(SFStringBundleObj.GetStringFromName('cantLoadLibCon') + ": " + SiteFusion.RemoteLibraries[n]);
			}
		}
	},
	
	/* This is the default progress listener for the basic login chrome
	   Adjust as nescessary in new brandings
	*/
	
	ProgressListener: {
		STAGE_NSLOOKUP_START: 1,
		STAGE_NSLOOKUP_COMPLETE: 2,
		STAGE_CONNECT_START: 3,
		STAGE_CONNECT_COMPLETE: 4,
		STAGE_LOADING_START: 5,
		STAGE_LOADING: 6,
		STAGE_LOADING_COMPLETE: 7,
		
		ERROR_NSLOOKUP_FAILED: 1,
		ERROR_SERVER_DOWN: 2,
		ERROR_SERVER_INVALID: 3,
		ERROR_LOGIN_INVALID: 4,
		
		onInit: function( savedDetails ) {
			for ( field in savedDetails ) {
				var el = document.getElementById(field);
				if (el) {
					el.value = savedDetails[field].value;
					if( savedDetails[field].forced )
						el.hidden = true;
				}
			}
		},
		
		onLogin: function( details ) {
			document.getElementById('button-login').disabled = true;
		},
		
		onProgress: function( stage, percent, currentLib, localizedText ) {
			var pm = document.getElementById( 'loginprogress' );
			var pmInfo = document.getElementById( 'loginprogress-info' );
			
			if( percent !== null ) {
				pm.mode = 'determined';
				pm.value = percent;
			}
			if( localizedText !== null ) {
				pmInfo.value = localizedText;
			}
		},
		
		onFinish: function( success, error, localizedText ) {
			var pmInfo = document.getElementById( 'loginprogress-info' );
			
			if( localizedText !== null ) {
				pmInfo.value = localizedText;
			}
			
			if( ! success )
				document.getElementById('button-login').disabled = false;
		},
	    onClose: function() {
	    	
	    },
	    onForgetLoginDetails: function() {

	    }
	}
};
