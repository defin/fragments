(function ($)
 {
     $.fragments = function (options)
     {
         var _settings = $.extend({}, $.fragments.defaults, options);

         var fragments =
             {
                 settings: _settings,
                 fragments: {},

                 addSources: function (sources)
                 {
                     if ( sources === undefined )
                         sources = this.settings.sources;

                     for ( var s in sources )
                         this.addSource(sources[s]);
                 },

                 processFragment: function (f)
                 {
                     if ( f !== undefined )
                     {
                         var $f = $(f);
                         var fragmentName = $f[0].id;
                         var fragmentBody = $f.children();
//                         console.log('processing fragment:', fragmentName);
                         this.fragments[fragmentName] = this.expandStubs(fragmentBody);
                     }
                 },

                 expandStubs: function (fragment)
                 {
                     var that = this;
                     var stubs = fragment.find('[class$="' + this.settings.stubSuffix + '"]');
//                   console.log('stubexpand', fragment, 'stubs', stubs);

                     stubs.each(function (k, stub)
                                {
                                    var stubName = stub.className;
                                    var base = stubName.split(that.settings.stubSuffix)[0];
//                                  console.log('stub', stub);

                                    if ( base in that.fragments )
                                        fragment.find('.' + stubName)
                                            .replaceWith(that.get(base));
                                    else
                                        alert('Could not expand stub ' + base + ', not defined');
                                });

                     return this.eliminateContainers(this.expandStrings(fragment));
                 },

                 expandStrings: function (fragment)
                 {
                     function walk (node, func)
                     {
                         func(node);
                         node = node.firstChild;
                         while (node)
                         {
                             walk(node, func);
                             node = node.nextSibling;
                         }
                     };

                     function lookup (str)
                     {
                         var s = str.split('.');
                         var i18n = require('i18n!nls/' + s[0]);
                         return i18n[s[1]];
                     };

                     function expandString (node)
                     {
                         if ( node.nodeType === 3 ) // TEXT_NODE
                             node.data = localization(node.data, lookup);

                         if ( node.nodeType === 1 && node.attributes.length > 0 ) // attributes only exists on ELEMENT_NODE
                             for ( var a = 0 ; a < node.attributes.length ; ++a)
                                 node.attributes[a].nodeValue = localization(node.attributes[a].nodeValue, lookup);
                     };

                     function localization (s, fn)
                     {
                         var match = s.match(/^(.*)__(.*)__(.*)$/m);
                         if ( match )
                             return match[1] + fn(match[2]) + match[3];
                         else
                             return s;
                     };

                     walk(fragment[0], expandString);

                     return fragment;
                 },

                 eliminateContainers: function (fragment)
                 {
                     if ( fragment.hasClass(this.settings.containerClass) )
                         return this.eliminateContainers(fragment.children());
                     else
                         return fragment;
                 },

                 sourcesLoaded: 0,
                 sourcesAdded: 0,
                 sources: [],
                 addSource: function (sourceToAdd)
                 {
                     var that = this;

                     function processSources ()
                     {
                         for (var src in that.sources )
                         {
                             var source = that.sources[src];

                             source.fragments
                                 .each(function (k, v)
                                       {
                                           that.processFragment(v);
                                       });
                         }

                         that.sources = [];
                     };

                     if ( this.settings.sourceType === 'html' )
                     {
                         var fragments = $(sourceToAdd).closest('div').children();
                         that.sources.push({"fragments": fragments});
                         processSources();
                     } else if ( this.settings.sourceType === 'url' ) {
                         var url = this.settings.sourcePrefix + sourceToAdd;
                         that.sources.push({"url": url});
                         ++this.sourcesAdded;

                         $.ajax({ url: url,
                                  data: {},
                                  dataType: 'html',
                                  success: function (html, status)
                                  {
                                      if ( status === 'success' )
                                      {
                                          var fragments = $(html).closest('div').children();
                                          for ( var s in that.sources )
                                          {
                                              var source = that.sources[s];
                                              if ( source.url === url )
                                                  source.fragments = fragments;
                                          }

                                          // synchronize processing fragments and issuing "ready" callback
                                          if ( ++that.sourcesLoaded === that.sourcesAdded )
                                          {
                                              processSources();
                                              that.settings.ready.call(that);
                                          }
                                      }
                                  },
                                  error: function (xhr, status, exception)
                                  {
                                      console.log('loading fragments failed from ' + url + ', ' + status + ': ' + exception);
                                      console.log('xhr', xhr);
                                  }
                                });
                     }
                 },

                 get: function (name)
                 {
                     if ( name in this.fragments )
                         return this.fragments[name].clone();
                     else
                         return null;
                 }
             };

         fragments.addSources();

         return fragments;
     };

     $.fragments.destroy = function ()
     {
         delete $.fragments;
     };

     $.fragments.defaults =
     {
         // list of sources to load fragments from initially
         'sources': [],

         // whether to treat sources as URLs or as HTML text
         'sourceType': 'url',

         // directory to prepend to entries in sources.  only used for "url" sourceType.
         'sourcePrefix': '',

         // function to call when sources become available.  only used for "url" sourceType.
         'ready': function () {},

         // class of containers that exist only for valid HTML definition and should be eliminated
         'containerClass': '_container',

         // suffix that should be added to stub references
         'stubSuffix': '_'
     };
 })(jQuery);
