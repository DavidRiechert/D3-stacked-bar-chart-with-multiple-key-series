import {
  AfterViewInit,
  Component,
  ElementRef,
  Input,
  OnChanges,
  SimpleChanges,
  ViewChild,
  ViewEncapsulation,
  ChangeDetectorRef,
} from '@angular/core';
import * as d3Base from 'd3';
import {legendColor} from 'd3-svg-legend';
import {Activity} from '../../../../models/activities';
import {Production} from '../../../../models/production';
import {MediaMatcher} from '@angular/cdk/layout';

@Component({
  selector: 'app-stacked-bar-chart',
  encapsulation: ViewEncapsulation.None,
  templateUrl: './stacked-bar-chart.component.html',
  styleUrls: ['./stacked-bar-chart.component.css'],
})
export class ActivitiesProductionChartComponent implements AfterViewInit, OnChanges {
  public update: Function;

  private _mobileQueryListener: () => void;
  mobileQuery: MediaQueryList;

  @ViewChild('productionChart', {static: true})
  public productionChart: ElementRef;

  @Input()
  productionData: Production[];

  @Input()
  activity: Activity;

  constructor(changeDetectorRef: ChangeDetectorRef, media: MediaMatcher) {
    this.mobileQuery = media.matchMedia('(max-width: 768px)');
    this._mobileQueryListener = () => changeDetectorRef.detectChanges();
    this.mobileQuery.addListener(this._mobileQueryListener);
  }

  public ngOnChanges(changes: SimpleChanges) {
    if (changes.productionData && this.productionData) {
      this.updateChart();
    }
    if (!changes.productionData && changes.activity && !changes.activity.firstChange) {
      const {currentValue, previousValue} = changes.activity;
      if (currentValue.unit !== previousValue.unit) {
        this.updateChart();
      }
    }
  }

  private updateChart() {
    if (this.productionData && this.update) {
      this.update(this.productionData);
    }
  }

  public ngAfterViewInit() {
    this.createProductionChart(this.activity);
  }

  public createProductionChart(activity): void {
    /// GENERAL CHART SETUP ///
    const d3 = Object.assign(d3Base, {legendColor});
    const margin = {left: 60, right: 30, top: 65, bottom: 50};
    const element = document.getElementById('productionChart');
    const width = element.offsetWidth;
    const graphWidth = width - margin.left - margin.right;
    const height = element.offsetHeight;
    const graphHeight = height - margin.top - margin.bottom;
    const animationTime = 750;
    const textColor = 'rgba(0,0,0,.54)';

    const svgProduction = d3
      .select(element)
      .append('svg')
      .attr('width', element.offsetWidth)
      .attr('height', element.offsetHeight);

    var g = svgProduction.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    const titleGroup = svgProduction.append('g').attr('transform', 'translate(20, 0)');
    var title = titleGroup.append('g').attr('transform', 'translate(0, 10)');

    var yAxisGroup = g
      .append('g')
      .attr('class', 'y axis')
      .attr('color', '#cfd8dc');

    var xAxisGroup = g
      .append('g')
      .attr('class', 'x axis')
      .attr('color', '#cfd8dc')
      .attr('transform', 'translate(0, ' + graphHeight + ')');

    var x = d3
      .scaleBand()
      .range([0, graphWidth])
      .padding(0.15);

    var y = d3.scaleLinear().rangeRound([graphHeight, 0]);
    var yAxisCall = d3.axisLeft(y).ticks(5);
    var xAxisCall = d3.axisBottom(x).tickFormat(d3.timeFormat('%b %d'));

    /// UPDATE FUNCTION ///
    this.update = function(data) {
      data = data.sort((a, b) => d3.ascending(a.date, b.date));

      let unit = this.activity.unit;

      const stackData1 = [];
      var len = data.length;
      var i = 0;
      var j = 0;

      for (i = 0; i < len; i++) {
        const date = new Date(data[i].date).toString().slice(0, 15);
        if (!stackData1.some(e => e.date === date)) {
          stackData1.push({date: date});
          stackData1[j][data[i].entity] = data[i].performance;
        } else {
          stackData1[j - 1][data[i].entity] = data[i].performance;
          j = j - 1;
        }
        j++;
      }

      console.log({stackData1});

      const entityKeys = [];
      let tempEntityKeys = [...new Set(data.map(item => (item.entity ? item.entity : '')))];
      tempEntityKeys.forEach(entity => (entity ? entityKeys.push(entity) : ''));

      entityKeys.sort();

      console.log({entityKeys});

      const shiftKeys = [];
      let tempShiftKeys = [...new Set(data.map(item => (item.shift ? item.shift : '')))];
      tempShiftKeys.forEach(shift => (shift ? shiftKeys.push(shift) : ''));

      console.log({shiftKeys});

      data = stackData1;

      console.log(data);

      const series = d3.stack().keys(entityKeys, shiftKeys)(data);

      console.log(series);

      var colorInterpolator = d3.interpolate('#82b1ff', '#0d47a1');

      var color = d3
        .scaleOrdinal()
        .domain(series.map(d => d.key))
        .range(d3.quantize(t => colorInterpolator(t * 0.7 + 0.0), series.length).reverse())
        .unknown('#82b1ff');

      x.domain(data.map(d => new Date(d.date)));
      y.domain([0, d3.max(series, d => d3.max(d, d => d[1]))]).nice();

      d3.selectAll('.title').remove();
      d3.selectAll('rect').remove();

      title
        .append('text')
        .attr('class', 'title')
        .text('Production' + ' ' + unit)
        .attr('x', 0)
        .attr('y', 25)
        .attr('text-anchor', 'start')
        .attr('text-transform', 'capitalize')
        .attr('font-size', '12px')
        .attr('fill', textColor);

      const t = d3.transition().duration(animationTime);

      var rectangle = g
        .append('g')
        .selectAll('g')
        .data(series)
        .join('g')
        .attr('fill', colorTween(entityKeys, color))
        .selectAll('rect')
        .data(d => d)
        .join('rect');

      rectangle.exit().remove();

      rectangle
        .attr('x', (d, i) => x(new Date(d.data.date)))
        .attr('y', d => y(d[0]))
        .attr('height', d => this._current)
        .attr('width', x.bandwidth())
        .classed('bars', true)
        .on('mouseover', mouseoverBar)
        .on('mousemove', mousemoveBar)
        .on('mouseout', mouseleaveBar);

      rectangle
        .enter()
        .append('rect')
        .attr('x', (d, i) => x(new Date(d.data.date)))
        .attr('y', d => y(d[1]))
        .attr('height', d => y(d[0]) - y(d[1]))
        .attr('width', x.bandwidth())
        .on('mouseover', mouseoverBar)
        .on('mousemove', mousemoveBar)
        .on('mouseout', mouseleaveBar)
        .each(function(d) {
          this._current = d;
        })
        .merge(rectangle)
        .transition(t)
        .attrTween('width', widthTween)
        .attr('y', yTween) // d => y(d[1])
        .attr('height', heightTween); // d => y(d[0])  y(d[1])

      yAxisGroup
        .transition(t)
        .call(yAxisCall)
        .selectAll('text')
        .attr('text-anchor', 'center')
        .attr('y', '0')
        .attr('x', '-15')
        .attr('transform', 'rotate(0)')
        .attr('font-size', '11px')
        .attr('font-family', 'Raleway')
        .attr('color', textColor);

      xAxisGroup
        .transition(t)
        .call(xAxisCall)
        .selectAll('text')
        .attr('y', '15')
        .attr('x', '-20')
        .attr('text-anchor', 'center')
        .attr('transform', 'rotate(-40)')
        .attr('font-size', '11px')
        .attr('font-family', 'Raleway')
        .attr('color', textColor);
    }; /// END UPDATE FUNCTION ///

    /// TOOLTIPS ///
    var tooltipBar = d3
      .select('#productionChart')
      .append('div')
      .style('position', 'absolute')
      .style('opacity', 0)
      .attr('class', 'tooltip')
      .style('padding', '10px')
      .style('background-color', 'white')
      .style('font-size', '12px')
      .style('border-radius', '3px')
      .style('width', '130px')
      .style('height', '90px')
      .style('color', '#263238')
      .style(
        'box-shadow',
        '0 2px 2px 0 rgba(0, 0, 0, 0.14), 0 3px 1px -2px rgba(0, 0, 0, 0.12), 0 1px 5px 0 rgba(0, 0, 0, 0.2)'
      );

    var mouseoverBar = function(d) {
      tooltipBar.style('opacity', 1);
    };

    var mousemoveBar = function(d) {
      tooltipBar
        .html(
          '<span style="color: #263238">' +
            d3.timeFormat('%Y %b %d')(new Date(d.data.date)) +
            '</span>' +
            '<br>' +
            `<span style="color: ${textColor}; margin: 0 auto; font-size: 12px">` +
            'Production' +
            '</span>' +
            '<br>' +
            '<span style="color: #263238; margin: 0 auto; font-size: 20px; font-weight: bold">' +
            d3
              .format(',.0f')(d[1] - d[0])
              .replace(/,/g, ' ')
              .replace(/\./, ',') +
            '</span>' +
            ' ' +
            `<span style="font-size: 12px; color: ${textColor}">` +
            activity.unit +
            '</span>'
        )
        .style('left', d3.mouse(this)[0] + 'px')
        .style('top', d3.mouse(this)[1] - 50 + 'px');
    };

    var mouseleaveBar = function(d) {
      tooltipBar.style('opacity', 0);
    };

    /// ANIMATION TWEENS ///
    const widthTween = data => {
      let i = d3.interpolate(0, x.bandwidth());
      return function(t) {
        return i(t);
      };
    };

    const yTween = d => {
      if (Number.isNaN(d[1])) {
        y(d[1]) === y(d[0]);
      } else {
        return y(d[1]);
      }
    };

    const heightTween = d => {
      if (Number.isNaN(d[1])) {
        y(d[1]) === y(d[0]);
      } else {
        return y(d[0]) - y(d[1]);
      }
    };

    function widthTweenUpdate(d) {
      var i = d3.interpolate(this._current, d);

      this._current = d;

      return function(t) {
        return i(t);
      };
    }

    function colorTween(k, c) {
      if (k.length === 1) {
        return '#82b1ff';
      } else {
        return d => c(d.key);
      }
    }

    const data = this.productionData;
    this.update(data);
  }

  public onResize() {
    if (!this.mobileQuery.matches) {
      this.createProductionChart(this.activity);
    }
  }
}
