var SectionNavigationController = Ember.ArrayController.extend({
  needs: ['dashboard/section'],
  itemController: 'sectionNavItem',
  sortedContent: function(){
    return this.sortBy('position');
  }.property('content.length'),
  stateManager: function() {
    return this.container.lookup('stateManager:sectionNavigation');
  }.property(),
  currentSection: Ember.computed.alias('controllers.dashboard/section.content')
});

export default SectionNavigationController;
