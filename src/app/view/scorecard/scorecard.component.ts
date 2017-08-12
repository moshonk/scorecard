import {Component, OnInit, Input, AfterViewInit, OnDestroy, EventEmitter, Output} from '@angular/core';
import {ScorecardService} from '../../shared/services/scorecard.service';
import {Subscription} from 'rxjs/Subscription';
import {FilterService} from '../../shared/services/filter.service';
import {TreeComponent} from 'angular-tree-component';
import {Angular2Csv} from 'angular2-csv';
import {FunctionService} from '../../shared/services/function.service';
import {VisualizerService} from '../dhis-visualizer/visulizer.service';
import {ScoreCard} from '../../shared/models/scorecard';
import {DataService} from '../../shared/services/data.service';

@Component({
  selector: 'app-scorecard',
  templateUrl: './scorecard.component.html',
  styleUrls: ['./scorecard.component.css']
})
export class ScorecardComponent implements OnInit, AfterViewInit, OnDestroy {

  private subscription: Subscription;
  private indicatorCalls: Subscription[] = [];
  @Input() scorecard: ScoreCard;
  @Input() period: any = [];
  @Input() default_period: any = [];
  @Input() orgUnit: any;
  @Input() period_type: string;
  @Input() show_sum_in_row: boolean = false;
  @Input() show_sum_in_column: boolean = false;
  @Input() show_average_in_row: boolean = false;
  @Input() show_average_in_column: boolean = false;
  @Input() shown_records: number = 0;
  @Input() average_selection: string = 'all';
  @Input() hidenColums: any[] = [];
  @Input() show_rank: boolean = false;
  @Input() sorting_column: any = 'none';
  @Input() orgunit_model: any;
  @Input() orgtree: TreeComponent;
  @Input() level: string = 'top';

  @Output() show_details = new EventEmitter<any>();
  @Output() updatedScorecard = new EventEmitter<any>();

  searchQuery: string = '';
  orgunits: any[] = [];
  proccessed_percent = 0;
  loading: boolean = true;
  loading_message: string;
  showSubScorecard: any[] = [];
  periods_list: any = [];
  keep_options_open: boolean = true;
  show_data_in_column: boolean = false;
  functions: any = [];
  data_current_sorting = true;
  data_sorting_on_progress = [];
  current_sorting = true;
  sorting_on_progress = [];
  sorting_period = '';


  indicator_loading: boolean[] = [];
  indicator_done_loading: boolean[] = [];
  period_loading: boolean[] = [];
  period_done_loading: boolean[] = [];
  old_proccessed_percent = 0;
  proccesed_indicators = 0;

  sub_unit;
  sub_model: any;
  children_available: boolean[] = [];
  subscorecard: ScoreCard;
  constructor(
    private dataService: DataService,
    private filterService: FilterService,
    private scorecardService: ScorecardService,
    private functionService: FunctionService,
    private visualizerService: VisualizerService
  ) {}

  ngOnInit() {
    // loading functions if any
    this.functionService.getAll().subscribe(
      (val) => {
      this.functions = val;
        this.loadScoreCard();
    }, (error) => {
        this.functions = [];
        this.loadScoreCard();
      });
    this.show_data_in_column = this.scorecard.data.show_data_in_column;

  }

  ngAfterViewInit() {

  }

  // a function to prepare a list of organisation units for analytics
  getOrgUnitsForAnalytics(orgunit_model): string {
    const orgUnits = [];
    let organisation_unit_analytics_string = '';
    // if the selected orgunit is user org unit
    if (orgunit_model.selection_mode === 'Usr_orgUnit') {
      if (orgunit_model.user_orgunits.length === 1 || orgunit_model.user_orgunits.length === 0) {
        const user_orgunit = this.orgtree.treeModel.getNodeById(orgunit_model.user_orgunits[0].id);
        orgUnits.push(user_orgunit.id);
        if (user_orgunit.hasOwnProperty('children')) {
          for ( const orgunit of user_orgunit.children ) {
            orgUnits.push(orgunit.id);
          }
        }
      }else {
        organisation_unit_analytics_string += orgunit_model.selected_user_orgunit;
      }
    }else {
      // if there is only one organisation unit selected
      if ( orgunit_model.selected_orgunits.length === 1 ) {
        const detailed_orgunit = this.orgtree.treeModel.getNodeById(orgunit_model.selected_orgunits[0].id);
        orgUnits.push(detailed_orgunit.id);
        if (detailed_orgunit.hasOwnProperty('children')) {
          for ( const orgunit of detailed_orgunit.children ) {
            orgUnits.push(orgunit.id);
          }
        }

      }else { // If there is more than one organisation unit selected
        orgunit_model.selected_orgunits.forEach((orgunit) => {
          orgUnits.push(orgunit.id);
        });
      }
      if (orgunit_model.selection_mode === 'orgUnit') {

      }if (orgunit_model.selection_mode === 'Level') {
        organisation_unit_analytics_string += orgunit_model.selected_level + ';';
      }if (orgunit_model.selection_mode === 'Group') {
        organisation_unit_analytics_string += orgunit_model.selected_group + ';';
      }
    }


    return organisation_unit_analytics_string + orgUnits.join(';');
  }

  // prepare a proper name for updating the organisation unit display area.
  getProperPreOrgunitName(): string {
    let name = '';
    if ( this.orgunit_model.selection_mode === 'Group' ) {
      const use_value = this.orgunit_model.selected_group.split('-');
      for ( const single_group of this.orgunit_model.orgunit_groups ) {
        if ( single_group.id === use_value[1] ) {
          name = single_group.name + ' in';
        }
      }
    }else if ( this.orgunit_model.selection_mode === 'Usr_orgUnit' ) {
      if ( this.orgunit_model.selected_user_orgunit === 'USER_ORGUNIT') { name = 'User org unit'; }
      if ( this.orgunit_model.selected_user_orgunit === 'USER_ORGUNIT_CHILDREN') { name = 'User sub-units'; }
      if ( this.orgunit_model.selected_user_orgunit === 'USER_ORGUNIT_GRANDCHILDREN') { name = 'User sub-x2-units'; }
    }else if ( this.orgunit_model.selection_mode === 'Level' ) {
      const use_level = this.orgunit_model.selected_level.split('-');
      for ( const single_level of this.orgunit_model.orgunit_levels ) {
        if ( single_level.level === use_level[1] ) {
          name = single_level.name + ' in';
        }
      }
    }else {
      name = '';
    }
    return name;
  }

  // get organisation unit name for display on scorecard title
  // get organisation unit name for display on scorecard title
  getOrgunitName(orgunit_model) {
    const name = [];
    let other_names = '';
    if ( orgunit_model.selected_orgunits.length === 1) {
      name.push( orgunit_model.selected_orgunits[0].name );
    }else { // If there is more than one organisation unit selected
      let i = 0;
      orgunit_model.selected_orgunits.forEach((orgunit) => {
        i++;
        if (i < 4) {
          name.push( orgunit.name );
        }else {

        }
      });
      if ( i >= 4 ) {
        const k = i - 3;
        other_names = ' and ' + k + ' Others';
      }
    }
    return name.join(', ') + other_names;
  }

  // get function details from id
  getFunction(id) {
    let return_function  = null;
    this.functions.forEach((funct) => {
      if ( id === funct.id ) {
        return_function = funct;
      }
    });
    return return_function;
  }

  // a function that will be used to load scorecard
  loadScoreCard( orgunit: any = null ) {
    this.showSubScorecard = [];
    this.periods_list = [];
    this.indicator_done_loading = [];
    this.proccessed_percent = 0;
    this.loading = true;
    this.orgunits = [];
    this.loading_message = ' Getting scorecard details ';
    // prepare period list( if not ready use the default period )
    if ( this.period.length === 0) {
      for ( const per of this.default_period ) {
        this.periods_list.push(per);
      }
    }else {
      for ( const per of this.period ) {
        this.periods_list.push(per);
      }
    }
    this.proccesed_indicators = 0;
    let old_proccesed_indicators = 0;
    const indicator_list = this.getIndicatorList(this.scorecard, this.periods_list);
    for ( const holder of this.scorecard.data.data_settings.indicator_holders ) {
        for ( const indicator of holder.indicators ) {
          if (this.level === 'top' || this.scorecard.data.is_bottleck) {
            indicator['values'] = [];
            indicator['tooltip'] = [];
            indicator['previous_values'] = [];
            indicator['showTopArrow'] = [];
            indicator['showBottomArrow'] = [];
          }

          indicator['loading'] = true;
          for ( const current_period of this.periods_list ) {
            this.period_loading[current_period.id] = true;

            // check if the indicator is supposed to come from function
            if (indicator.hasOwnProperty('calculation') && indicator.calculation === 'custom_function' ) {
              console.log('Indicator', indicator);
              const parameters = {
                dx: indicator.id,
                ou: this.getOrgUnitsForAnalytics(this.orgunit_model),
                pe: current_period.id,
                success: (data) => {
                  //  This will run on successfull function return, which will save the result to the data store for analytics
                  //  console.log( 'analytics:', JSON.stringify(data));
                  indicator.loading = false;
                  this.loading_message = ' Done Fetching data for ' + indicator.title + ' ' + current_period.name;
                  this.proccesed_indicators++;
                  this.proccessed_percent = (this.proccesed_indicators / indicator_list.length) * 100;
                  if (this.proccesed_indicators === indicator_list.length ) {
                    this.loading = false;
                  }
                  // noinspection TypeScriptUnresolvedVariable
                  for ( const orgunitId of data.metaData.ou ) {
                    if (!this.checkOrgunitAvailability(orgunitId, this.orgunits)) {
                      if ( this.scorecard.data.show_data_in_column ) {
                        // noinspection TypeScriptUnresolvedVariable
                        this.orgunits.push({'id': orgunitId,
                          'name': data.metaData.names[orgunitId],
                          'is_parent': false
                        });
                      }else {
                        // noinspection TypeScriptUnresolvedVariable
                        this.orgunits.push({'id': orgunitId,
                          'name': data.metaData.names[orgunitId],
                          'is_parent': this.orgUnit.id === orgunitId
                        });
                      }

                    }

                    const value_key = orgunitId + '.' + current_period.id;
                    const data_config = [{'type': 'ou', 'value': orgunitId}, {'type': 'pe', 'value': current_period.id}];
                    indicator.values[value_key] = this.visualizerService.getDataValue( data, data_config );
                  }
                  this.shown_records = this.orgunits.length;
                  this.indicator_loading[indicator.id] = false;
                },
                error: (error) => {
                  console.log('error');
                },
                progress: (progress) => {
                  console.log('progress');
                }
              };
              const use_function = this.getFunction( indicator.function_to_use );
              const execute = Function('parameters', use_function['function']);
              execute(parameters);
            }else {
              this.indicatorCalls.push(this.dataService.getIndicatorsRequest(this.getOrgUnitsForAnalytics(this.orgunit_model), current_period.id, indicator.id)
                .subscribe(
                  (data) => {
                    indicator.loading = false;
                    this.loading_message = ' Done Fetching data for ' + indicator.title + ' ' + current_period.name;
                    this.proccesed_indicators++;
                    this.proccessed_percent = (this.proccesed_indicators / indicator_list.length) * 100;
                    if (this.proccesed_indicators === indicator_list.length ) {
                      this.loading = false;
                    }
                    // noinspection TypeScriptUnresolvedVariable
                    for ( const orgunitId of data.metaData.ou ) {
                      if (!this.checkOrgunitAvailability(orgunitId, this.orgunits)) {
                        if ( this.scorecard.data.show_data_in_column ) {
                          //noinspection TypeScriptUnresolvedVariable
                          this.orgunits.push({'id': orgunitId,
                            'name': data.metaData.names[orgunitId],
                            'is_parent': false
                          });
                        }else {
                          //noinspection TypeScriptUnresolvedVariable
                          this.orgunits.push({'id': orgunitId,
                            'name': data.metaData.names[orgunitId],
                            'is_parent': this.orgUnit.id === orgunitId
                          });
                        }

                      }

                      const value_key = orgunitId + '.' + current_period.id;
                      const data_config = [{'type': 'ou', 'value': orgunitId}, {'type': 'pe', 'value': current_period.id}];
                      indicator.values[value_key] = this.visualizerService.getDataValue( data, data_config );
                    }
                    this.shown_records = this.orgunits.length;
                    this.indicator_loading[indicator.id] = true;
                    // load previous data
                    const effective_gap = parseInt( indicator.arrow_settings.effective_gap );
                    this.indicatorCalls.push(this.dataService.getIndicatorsRequest(this.getOrgUnitsForAnalytics(this.orgunit_model), '201606', indicator.id)
                      .subscribe(
                        ( olddata ) => {
                          for ( const prev_orgunit of this.orgunits ) {
                            const prev_key = prev_orgunit.id + '.' + current_period.id;
                            indicator.previous_values[prev_key] = this.dataService.getIndicatorData(prev_orgunit.id, '201605', olddata);
                          }
                          if (indicator.hasOwnProperty('arrow_settings')) {
                            for ( const key in indicator.values ) {
                              if (key) {
                                const splited_key = key.split('.');
                                if (parseInt(indicator.previous_values[key]) !== 0) {
                                  const check = parseInt( indicator.values[key] ) > (parseInt( indicator.previous_values[key] ) + effective_gap );
                                  const check1 = parseInt( indicator.values[key] ) < (parseInt( indicator.previous_values[key] ) - effective_gap );
                                  indicator.showTopArrow[key] = check;
                                  indicator.showBottomArrow[key] = check1;
                                  if (indicator.showTopArrow[key] && indicator.values[key] !== null && indicator.previous_values[key] !== null && olddata.metaData.names.hasOwnProperty(splited_key[0])) {
                                    const rise = indicator.values[key] - parseInt( indicator.previous_values[key]);
                                    //noinspection TypeScriptUnresolvedVariable
                                    indicator.tooltip[key] = indicator.title + ' has raised by ' + rise.toFixed(2) + ' from ' + this.getPeriodName(current_period.id) + ' for ' + data.metaData.names[splited_key[0]] + ' (Minimum gap ' + indicator.arrow_settings.effective_gap + ')';
                                  }//noinspection TypeScriptUnresolvedVariable
                                  if (indicator.showBottomArrow[key] && indicator.values[key] !== null && indicator.previous_values[key] !== null && olddata.metaData.names.hasOwnProperty(splited_key[0])) {
                                    const rise = parseFloat( indicator.previous_values[key] ) - indicator.values[key];
                                    //noinspection TypeScriptUnresolvedVariable
                                    indicator.tooltip[key] = indicator.title + ' has decreased by ' + rise.toFixed(2) + ' from ' + this.getPeriodName(current_period.id) + ' for ' + data.metaData.names[splited_key[0]] + ' (Minimum gap ' + indicator.arrow_settings.effective_gap + ')';
                                  }
                                }
                              }
                            }
                          }
                          this.indicator_loading[indicator.id] = false;
                          this.indicator_done_loading[indicator.id] = true;
                          this.period_loading[current_period.id] = false;
                          this.period_done_loading[current_period.id] = true;
                          old_proccesed_indicators++;
                          this.old_proccessed_percent = (old_proccesed_indicators / indicator_list.length) * 100;
                          if (this.old_proccessed_percent === 100) {
                            this.updatedScorecard.emit(this.scorecard);
                          }
                        })
                    ); },
                  error => {

                  }
                ));
            }

          }

        }
      }
  }


  // loading sub orgunit details
  loadChildrenData(selectedorgunit, indicator) {
    this.showSubScorecard = [];
    if ( indicator === null ) {
      if ( selectedorgunit.is_parent || this.showSubScorecard[selectedorgunit.id]) {
        this.showSubScorecard = [];
      }else {
        const orgunit_with_children = this.orgtree.treeModel.getNodeById(selectedorgunit.id);
        this.sub_unit = orgunit_with_children.data;
        this.sub_model = {
          selection_mode: 'orgUnit',
          selected_level: '',
          selected_group: '',
          orgunit_levels: [],
          orgunit_groups: [],
          selected_orgunits: [this.sub_unit],
          user_orgunits: []
        };
        this.showSubScorecard[selectedorgunit.id] = true;
        if ( this.sub_unit.hasOwnProperty('children')) {
          this.children_available[selectedorgunit.id] = true;
        }else {
          setTimeout(function() {
            this.showSubScorecard = [];
          }, 5000);
        }

      }
    }
    if ( selectedorgunit === null ) {

      if ( this.showSubScorecard[indicator.id]) {
        this.showSubScorecard = [];
      }
      this.scorecardService.getRelatedIndicators(indicator.id).subscribe(
        (data) => {
          console.log(data);
          if ( data.length === 0) {
            this.children_available[indicator.id] = false;
            this.showSubScorecard[indicator.id] = true;
          }else {
            this.children_available[indicator.id] = true;
            // this.subscorecard = this.createScorecardByIndicators(indicator,indicator.bottleneck_indicators);
            const created_scorecard = this.scorecardService.getEmptyScoreCard();
            const legendSet = [
              {
                color: '#008000',
                min: '80',
                max: '-'
              },
              {
                color: '#FFFF00',
                min: '60',
                max: '80'
              },
              {
                color: '#FF0000',
                min: '0',
                max: '60'
              }
            ];
            const holder_ids = [];
            data.forEach((item, item_index) => {
              // check first if it is a function or not
              const indicator_structure = this.scorecardService.getIndicatorStructure(item.name, item.id, legendSet, item.bottleneck_title);
              if (item.hasOwnProperty('function')) {
                indicator_structure.calculation = 'custom_function';
                indicator_structure.function_to_use = item.function;
              }else {
                indicator_structure.calculation = 'analytics';
              }
              const indicator_holder = {
                'holder_id': item_index + 1,
                'indicators': [
                  indicator_structure
                ]
              };
              holder_ids.push(item_index + 1);
              created_scorecard.data.data_settings.indicator_holders.push(indicator_holder);
            });

            created_scorecard.data.data_settings.indicator_holder_groups = [{
              'id': '1',
              'name': 'New Group',
              'indicator_holder_ids': holder_ids,
              'background_color': '#ffffff',
              'holder_style': null
            }];
            created_scorecard.data.show_data_in_column = true;
            created_scorecard.data.is_bottleck = true;
            created_scorecard.data.name = 'Bottleneck Indicators for ' + indicator.name;
            created_scorecard.data.header.title = 'Bottleneck Indicators for ' + indicator.name;
            this.subscorecard = created_scorecard;
            console.log(this.subscorecard);
            this.showSubScorecard[indicator.id] = true;
          }

        },
        (error) => {
          this.children_available[indicator.id] = false;
          this.showSubScorecard[indicator.id] = true;
        }
      );

    }

  }

  // prepare scorecard data and download them as csv
  downloadCSV() {
    const data = [];
    for ( const current_orgunit of this.orgunits ) {
      const dataobject = {};
      dataobject['orgunit'] = current_orgunit.name;
      for ( const holder of this.scorecard.data.data_settings.indicator_holders ) {
        for ( const indicator of holder.indicators ) {
          for ( const current_period of this.periods_list ) {
            const value_key = current_orgunit.id + '.' + current_period.id;
            const name = ( this.periods_list.length > 1) ? indicator.title + ' ' + current_period.name : indicator.title;
            dataobject[name] = indicator.values[value_key];
          }
        }

      }
      data.push( dataobject  );
    }

    const options = {
      fieldSeparator: ',',
      quoteStrings: '\'',
      decimalseparator: '.',
      showLabels: true,
      showTitle: false
    };

    const csv = new Angular2Csv(data, 'My Report', options);
  }


  // get number of visible indicators from a holder
  getVisibleIndicators(holder) {
    const indicators =  [];
    for ( const indicator of holder.indicators ) {
      if ( this.hidenColums.indexOf(indicator.id) === -1) {
        indicators.push(indicator);
      }
    }
    return indicators;
  }

  // helper function to set label value( helpful when there is more than one indicator)
  getIndicatorLabel(indicator, label) {
    const labels = [];
    for ( const data of indicator.indicators ) {
      if (data.additional_label_values[label] !== null && data.additional_label_values[label] !== '' && this.hidenColums.indexOf(data.id) === -1) {
        labels.push(data.additional_label_values[label]);
      }
    }
    return labels.join(' / ');
  }

  // a function to prepare a list of indicators to pass into a table
  getIndicatorList(scorecard, period_list): string[] {
    const indicators = [];
    for ( const holder of scorecard.data.data_settings.indicator_holders ) {
      for ( const indicator of holder.indicators ) {
        for ( const per of period_list ) {
          indicators.push(indicator.id + ';' + per.id);
        }
      }
    }
    return indicators;
  }

  // a function to see if orgunit is already in the list
  checkOrgunitAvailability(id, array) {
    let check = false;
    for ( const orgunit of array ) {
      if (orgunit.id === id) {
        check = true;
      }
    }
    return check;
  }

  // Get the name of the last period for a tooltip display
  getPeriodName(id: string) {
    return '';

  }

  // helper function to dynamical provide colspan attribute for a group
  getGroupColspan(group_holders) {
    let colspan = 0;
    for ( const holder of this.scorecard.data.data_settings.indicator_holders ) {
      if (group_holders.indexOf(holder.holder_id) !== -1) {
        let hide_this: boolean = true;
        for ( const indicator of holder.indicators ) {
          if ( this.hidenColums.indexOf(indicator.id) === -1) {
            hide_this = false;
          }
        }
        if ( !hide_this ) {
          for ( const per of this.periods_list) {
            colspan++;
          }
        }
      }
    }
    return colspan;
  }

  // A function used to decouple indicator list and prepare them for a display
  getItemsFromGroups() {
    const indicators_list = [];
    for (const data of this.scorecard.data.data_settings.indicator_holder_groups ) {
      for ( const holders_list of data.indicator_holder_ids ) {
        for ( const holder of this.scorecard.data.data_settings.indicator_holders ) {
          if (holder.holder_id === holders_list) {
            // check if indicators in a card are hidden so don show them
            let hide_this: boolean = true;
            for ( const indicator of holder.indicators ) {
              if ( this.hidenColums.indexOf(indicator.id) === -1) {
                hide_this = false;
              }
            }
            if ( !hide_this ) { indicators_list.push(holder); }
          }
        }
      }
    }
    return indicators_list;
  }

  // A function used to decouple indicator list and prepare them for a display
  getSubscorecardColspan() {
    let indicators_list = 0;
    for (const data of this.scorecard.data.data_settings.indicator_holder_groups ) {
      for ( const holders_list of data.indicator_holder_ids ) {
        for ( const holder of this.scorecard.data.data_settings.indicator_holders ) {
          if (holder.holder_id === holders_list) {
            // check if indicators in a card are hidden so don show them
            let hide_this: boolean = true;
            for ( const indicator of holder.indicators ) {
              if ( this.hidenColums.indexOf(indicator.id) === -1) {
                hide_this = false;
              }
            }
            if ( !hide_this ) {
              for ( const per of this.periods_list ) {
                indicators_list++;
              }
            }
          }
        }
      }
    }
    return indicators_list + 1;
  }


  // simplify title displaying by switching between two or on indicator
  getIndicatorTitle(holder): string {
    const title = [];
    for ( const data of holder.indicators ) {
      if ( this.hidenColums.indexOf(data.id) === -1 ) {
        title.push(data.title);
      }
    }
    return title.join(' / ');
  }

  // a function to prepare a list of indicators to pass into a table
  getIndicatorsList(scorecard): string[] {
    const indicators = [];
    for ( const holder of scorecard.data.data_settings.indicator_holders ) {
      for ( const indicator of holder.indicators ) {
        indicators.push(indicator);
      }
    }
    return indicators;
  }

  // check if a column is empty
  isRowEmpty(orgunit_id: string): boolean {
    let checker = false;
    let sum = 0;
    let counter = 0;
    for ( const holder of this.scorecard.data.data_settings.indicator_holders ) {
      for ( const indicator of holder.indicators ) {
        if ( this.hidenColums.indexOf(indicator.id) === -1) {
          sum++;
        }
        if ( this.hidenColums.indexOf(indicator.id) === -1 && indicator.values[orgunit_id] === null ) {
          counter++;
        }
      }
    }
    if (counter === sum && !this.scorecard.data.empty_rows) {
      checker = true;
    }
    return checker;
  }

  averageHidden(orgunit_id: string, period: string): boolean {
    let checker = false;
    const avg = this.findRowTotalAverage(this.orgunits, period);
    if ( this.average_selection === 'all') {
      checker = false;
    }else if ( this.average_selection === 'below') {
      if ( this.findRowAverage(orgunit_id, this.periods_list, null) >= avg ) {
        checker = true;
      }
    }else if ( this.average_selection === 'above') {
      if ( this.findRowAverage(orgunit_id, this.periods_list, null) <= avg ) {
        checker = true;
      }
    }
    return checker;
  }

  // check if column is empty
  isEmptyColumn(orgunits, indicator_id, scorecard) {
    let sum = 0;
    for ( const orgunit of orgunits ) {
      for ( const holder of scorecard.data.data_settings.indicator_holders ) {
        for ( const indicator of holder.indicators ) {
          if (indicator.id === indicator_id && indicator.values[orgunit.id] === null) {
            sum++;
          }
        }
      }
    }
    if (sum === orgunits.length) {

    }
  }
  /**
   * finding the row average
   * @param orgunit_id
   */
  findRowAverage(orgunit_id, periods_list, period) {
    let sum = 0;
    let counter = 0;
    if (period === null) {
      for ( const holder of this.scorecard.data.data_settings.indicator_holders ) {
        for ( const indicator of holder.indicators ) {
          for ( const per of periods_list ) {
            const use_key = orgunit_id + '.' + per.id;
            if ( this.hidenColums.indexOf(indicator.id) === -1 && indicator.values[use_key] !== null ) {
              counter++;
              sum = sum + parseFloat(indicator.values[use_key]);
            }
          }
        }
      }
    }else {
      const use_key = orgunit_id + '.' + period;
      for ( const holder of this.scorecard.data.data_settings.indicator_holders ) {
        for ( const indicator of holder.indicators ) {
          if ( this.hidenColums.indexOf(indicator.id) === -1 && indicator.values[use_key] !== null ) {
            counter++;
            sum = sum + parseFloat(indicator.values[use_key]);
          }
        }
      }
    }

    return (sum / counter).toFixed(2);
  }
  /**
   * finding the row average
   * @param orgunit_id
   */
  findRowTotalAverage(orgunits, period) {
    let sum = 0;
    let n = 0;
    for ( const holder of this.scorecard.data.data_settings.indicator_holders ) {
      for ( const indicator of holder.indicators ) {
        if ( this.hidenColums.indexOf(indicator.id) === -1 ) {
          for ( const orgunit of orgunits ) {
            const usekey = orgunit.id + '.' + period;
            if (usekey in indicator.values && indicator.values[usekey] !== null) {
              n++;
              sum = sum + parseFloat(indicator.values[usekey]);
            }
          }
        }
      }
    }
    return (sum / n).toFixed(2);
  }

  /**
   * finding the row average
   * @param orgunit_id
   */
  findRowTotalSum(orgunits, period) {
    let sum = 0;
    let n = 0;
    for ( const holder of this.scorecard.data.data_settings.indicator_holders ) {
      for ( const indicator of holder.indicators ) {
        if ( this.hidenColums.indexOf(indicator.id) === -1 ) {
          for ( const orgunit of orgunits ) {
            const use_key = orgunit.id + '.' + period;
            if (orgunit.id in indicator.values && indicator.values[use_key] !== null) {
              n++;
              sum = sum + parseFloat(indicator.values[use_key]);
            }
          }
        }
      }
    }
    return sum;
  }

  /**
   * Finding avarage for the column
   * @param orgunits, indicator_id
   */
  findColumnAverage(orgunits, indicator_id, scorecard) {
    let sum = 0;
    for ( const orgunit of orgunits ) {
      for ( const holder of scorecard.data.data_settings.indicator_holders ) {
        for ( const indicator of holder.indicators ) {
          if (orgunit.id in indicator.values && indicator.id === indicator_id) {
            sum = sum + parseFloat(indicator.values[orgunit.id]);
          }
        }
      }
    }
    return (sum / this.getIndicatorsList(this.scorecard).length).toFixed(2);
  }

  /**
   * Finding avarage for the column
   * @param orgunits, indicator_id
   */
  findColumnSum(orgunits, indicator_id, scorecard) {
    let sum = 0;
    for ( const orgunit of orgunits ) {
      for ( const holder of scorecard.data.data_settings.indicator_holders ) {
        for ( const indicator of holder.indicators ) {
          if (orgunit.id in indicator.values && indicator.id === indicator_id) {
            sum = sum + parseFloat(indicator.values[orgunit.id]);
          }
        }
      }
    }
    return sum;
  }

  /**
   * finding the row average
   * @param orgunit_id
   */
  findRowSum(orgunit_id: string, period: string) {
    let sum = 0;
    const use_key = orgunit_id + '.' + period;
    for ( const holder of this.scorecard.data.data_settings.indicator_holders ) {
      for ( const indicator of holder.indicators ) {
        if (orgunit_id in indicator.values && indicator.values[use_key] !== null ) {
          if ( this.hidenColums.indexOf(indicator.id) === -1) {
            sum = sum + parseFloat(indicator.values[use_key]);
          }
        }
      }
    }
    return sum;
  }

  getCorrectColspan() {
    let i = 0;
    if (this.show_sum_in_row) {
      i++;
    }
    if (this.show_average_in_row) {
      i++;
    }if (this.scorecard.data.show_rank) {
      i++;
    }
    return i;
  }

  // prepare a proper tooltip to display to counter multiple indicators in the same td
  prepareTooltip(holder, orgunit, period): string {
    const tooltip = [];
    const use_key = orgunit + '.' + period;
    for ( const indicator of holder.indicators ) {
      if (indicator.tooltip && indicator.tooltip[use_key]) {
        tooltip.push(indicator.tooltip[use_key]);
      }
    }
    return tooltip.join(', ');
  }


  getCursorStyle(orgunit) {
    if (orgunit.is_parent) {
      return 'default';
    }else {
      return 'pointer';
    }
  }

  // sorting scorecard by clicking the header(if two item in same list will use first item)
  sortScoreCardFromColumn(sortingColumn, sortAscending, orguUnits, period: string, lower_level: boolean = true) {
    this.current_sorting = !this.current_sorting;
    this.sorting_column = sortingColumn;
    this.sorting_period = period;
    this.sorting_on_progress[this.sorting_column] = true;
    sortAscending = this.current_sorting;
    if ( sortingColumn === 'none' ) {
      this.dataService.sortArrOfObjectsByParam(orguUnits, 'name', sortAscending);
    }else if ( sortingColumn === 'avg' ) {
      for ( const orgunit of orguUnits ) {
        orgunit['avg'] = parseFloat(this.findRowAverage(orgunit.id, this.periods_list, null));
      }
      this.dataService.sortArrOfObjectsByParam(orguUnits, sortingColumn, sortAscending);
    }else if ( sortingColumn === 'sum' ) {
      for ( const orgunit of orguUnits ) {
        orgunit['sum'] = this.findRowSum(orgunit.id, period);
      }
      this.dataService.sortArrOfObjectsByParam(orguUnits, sortingColumn, sortAscending);
    }else {
      for ( const orgunit of orguUnits ) {
        orgunit[sortingColumn] = this.findOrgunitIndicatorValue(orgunit.id, sortingColumn, period );
      }
      this.dataService.sortArrOfObjectsByParam(orguUnits, sortingColumn, sortAscending);
    }
    this.sorting_on_progress[this.sorting_column] = false;
    this.sorting_column = (lower_level) ? 'none' : sortingColumn;
  }

  /**
   *sorting scorecard by clicking the header(if two item in same list will use first item)
   * will be applicable when data is on the left
   */
  sortDataScoreCardFromColumn(sortingColumn, sortAscending, orguUnits, period: string, lower_level: boolean = true) {
    this.data_current_sorting = !this.data_current_sorting;
    this.sorting_column = sortingColumn;
    this.sorting_on_progress[this.sorting_column] = true;
    sortAscending = this.current_sorting;
    if ( sortingColumn === 'none' ) {
      this.dataService.sortArrOfObjectsByParam(orguUnits, 'name', sortAscending);
    }else if ( sortingColumn === 'avg' ) {
      for ( const orgunit of orguUnits ) {
        orgunit['avg'] = parseFloat(this.findRowAverage(orgunit.id, this.periods_list, null));
      }
      this.dataService.sortArrOfObjectsByParam(orguUnits, sortingColumn, sortAscending);
    }else if ( sortingColumn === 'sum' ) {
      for ( const orgunit of orguUnits ) {
        orgunit['sum'] = this.findRowSum(orgunit.id, period);
      }
      this.dataService.sortArrOfObjectsByParam(orguUnits, sortingColumn, sortAscending);
    }else {
      for ( const orgunit of orguUnits ) {
        orgunit[sortingColumn] = this.findOrgunitIndicatorValue(orgunit.id, sortingColumn, period );
      }
      this.dataService.sortArrOfObjectsByParam(orguUnits, sortingColumn, sortAscending);
    }
    this.sorting_on_progress[this.sorting_column] = false;
    this.sorting_column = (lower_level) ? 'none' : sortingColumn;
  }

  // hack to find a value of indicator for a specific orgunit
  private findOrgunitIndicatorValue(orgunit_id: string, indicator_id: string, period: string) {
    let val: number = 0;
    const use_key = orgunit_id + '.' + period;
    for ( const holder of this.scorecard.data.data_settings.indicator_holders ) {
      for ( const indicator of holder.indicators ) {
        if (use_key in indicator.values && indicator.values[use_key] !== null && indicator.id === indicator_id) {
          val = parseFloat(indicator.values[use_key]);
        }
      }
    }
    return val;
  }

  // load a preview function
  loadPreview(holderGroup, indicator, ou, period) {
    // emit the array with these items;
    this.show_details.emit({
      holderGroup: holderGroup,
      indicator: indicator,
      ou: ou,
      period: period
    });
  }

  // load a preview function when event
  loadPreviewFromChild($event) {
    // emit the array with these items;
    this.show_details.emit({
      holderGroup: $event.holderGroup,
      indicator: $event.indicator,
      ou: $event.ou
    });
  }

  // deals with the drag and drop issue
  dragItemSuccessfull($event, drop_area: string, object: any) {
    if ( drop_area === 'orgunit') {
      if ( $event.dragData.hasOwnProperty('holder_id') ) {
        this.scorecard.data.show_data_in_column = !this.scorecard.data.show_data_in_column;
      }else if ($event.dragData.hasOwnProperty('indicator_holder_ids')) {
        this.scorecard.data.show_data_in_column = !this.scorecard.data.show_data_in_column;
      }else {
        const number = (this.getOrgunitPosition($event.dragData.id) > this.getOrgunitPosition(object.id)) ? 0 : 1;
        this.deleteOrgunit( $event.dragData );
        this.insertOrgunit( $event.dragData, object, number);
      }
    }else if (drop_area === 'indicator') {
      if ( $event.dragData.hasOwnProperty('holder_id') ) {
        if ( $event.dragData.holder_id === object.holder_id ) {
          console.log('cant move item to itself');
        }else {
          const position = this.getHolderPosition($event.dragData, object);
          this.deleteHolder( $event.dragData );
          this.insertHolder( $event.dragData, object, position);
        }
      }else if ($event.dragData.hasOwnProperty('indicator_holder_ids')) {

      }else {
        this.scorecard.data.show_data_in_column = !this.scorecard.data.show_data_in_column;
      }
    }else if (drop_area === 'group') {
      if ( $event.dragData.hasOwnProperty('holder_id') ) {
        const last_holder = ( object.indicator_holder_ids.length === 0 ) ? 0 : object.indicator_holder_ids.length - 1;
        if (object.indicator_holder_ids.indexOf($event.dragData.holder_id) === -1) {
          this.deleteHolder( $event.dragData );
          this.insertHolder( $event.dragData, this.getHolderById(object.indicator_holder_ids[last_holder]), 1);
        }else { }
      }else if ($event.dragData.hasOwnProperty('indicator_holder_ids')) {
        if ($event.dragData.id !== object.id) {
          this.scorecard.data.data_settings.indicator_holder_groups.forEach((group, group_index) => {
            if ( group.id === $event.dragData.id) {
              this.scorecard.data.data_settings.indicator_holder_groups.splice(group_index, 1);
            }
          });
          this.scorecard.data.data_settings.indicator_holder_groups.forEach((group, group_index) => {
            if ( group.id === object.id && this.getgroupById($event.dragData.id) === null) {
              this.scorecard.data.data_settings.indicator_holder_groups.splice(group_index, 0, $event.dragData);
            }
          });
        }
      }else {
        this.show_data_in_column = !this.show_data_in_column;
      }
    }else {
    }
  }

  // get indicator group by Id this function helps to check if the group is available or not
  getgroupById(group_id) {
    let return_id = null;
    for ( const group of this.scorecard.data.data_settings.indicator_holder_groups ) {
      if ( group.id === group_id ) {
        return_id = group;
        break;
      }
    }
    return return_id;
  }

  // this function will return an holder with specified ID
  getHolderById( holder_id ) {
    let return_id = null;
    for ( const holder of this.scorecard.data.data_settings.indicator_holders ) {
      if ( holder.holder_id === holder_id ) {
        return_id = holder;
        break;
      }
    }
    return return_id;
  }

  // This function will find the location of holder in the group and delete it
  deleteHolder( holder_to_delete ) {
    this.scorecard.data.data_settings.indicator_holder_groups.forEach((group, holder_index) => {
      group.indicator_holder_ids.forEach((holder, indicator_index) => {
        if ( holder === holder_to_delete.holder_id) {
          group.indicator_holder_ids.splice(indicator_index, 1);
        }
      });
    });
  }

  // This function will add a new holder in the place of the current holder
  // TODO: Check if it is forward movement of backward movement
  insertHolder( holder_to_insert, current_holder, num: number ) {
    this.scorecard.data.data_settings.indicator_holder_groups.forEach((group, holder_index) => {
      group.indicator_holder_ids.forEach((holder, indicator_index) => {
        if ( holder === current_holder.holder_id && group.indicator_holder_ids.indexOf(holder_to_insert.holder_id) === -1) {
          group.indicator_holder_ids.splice( indicator_index + num, 0, holder_to_insert.holder_id );
        }
      });
    });
  }

  // Dertimine if indicators are in the same group and say whether the first is larger of not
  getHolderPosition(holder_to_check, current_holder) {
    let holders_in_same_group = false;
    let holder_group = null;
    let increment_number = 0;
    this.scorecard.data.data_settings.indicator_holder_groups.forEach((group, holder_index) => {
      if (group.indicator_holder_ids.indexOf(holder_to_check.holder_id) !== -1 && group.indicator_holder_ids.indexOf(current_holder.holder_id) !== -1) {
        holders_in_same_group = true;
        holder_group = group.indicator_holder_ids;
      }
    });
    if (holders_in_same_group) {
      if ( holder_group.indexOf(holder_to_check.holder_id) > holder_group.indexOf(current_holder.holder_id)) {
        increment_number = 0;
      }else {
        increment_number = 1;
      }
    }
    return increment_number;
  }

  // this function will delete orgunit from the list of organisation units
  deleteOrgunit( orgunit_to_delete ) {
    this.orgunits.forEach((orgunit, orgunit_index) => {
        if ( orgunit_to_delete.id === orgunit.id) {
          this.orgunits.splice(orgunit_index, 1);
        }
    });
  }

  // This function will add orgunit in the behind of the provided orgunit
  insertOrgunit( orgunit_to_insert, current_orgunit, num: number ) {
    this.orgunits.forEach((orgunit, orgunit_index) => {
      if ( current_orgunit.id === orgunit.id && !this.orgunitAvailable(orgunit_to_insert.id)) {
        this.orgunits.splice(orgunit_index + num, 0, orgunit_to_insert);
      }
    });
  }

  // This function is used to check if Organisation unit is available
  orgunitAvailable(orgunit_id: string): boolean {
    let checker = false;
    this.orgunits.forEach((orgunit, orgunit_index) => {
      if ( orgunit_id === orgunit.id ) {
        checker = true;
      }
    });
    return checker;
  }

  // Get the position of the organisation unit.
  getOrgunitPosition(orgunit_id) {
    let orgunit_index = null;
    this.orgunits.forEach((orgunit, index) => {
      if (orgunit.id === orgunit_id) {
        orgunit_index = index;
      }
    });
    return orgunit_index;
  }

  // findinf a proper row-span for no, average and additional labels
  getCurrentRowsPan(): number {
    if (this.periods_list.length === 1 || this.periods_list.length === 0 ) {
      return 1;
    }else if ( this.periods_list.length > 1 ) {
      return 2;
    }
  }

  // Use this for all clean ups
  ngOnDestroy () {
    if ( this.subscription ) {
      this.subscription.unsubscribe();
    }

    for ( const subscr of this.indicatorCalls ) {
      if ( subscr ) {
        subscr.unsubscribe();
      }
    }
  }


}
