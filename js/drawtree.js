var margin = {top: 10, right: 40, bottom: 10, left: 0},
  padding = {right: 15}
  width = 250 - margin.left - margin.right - padding.right,
  height = 1200 - margin.top - margin.bottom;

// to store colour palettes
var sample_pal, coldate_pal, diverge_pal;

// set up plotting scales
var xValue = function(d) { return d.x; },
  xScale = d3.scaleLinear().range([0, width]),
  xMap1 = function(d) { return xScale(d.x1); },  // lines
  xMap2 = function(d) { return xScale(d.x2); },
  xWide = function(d) { return xScale(d.x2 - d.x1)};

// define minimum width for rect elements (required in instances where first and last coldates are the same)
var minRectWidth = 7;

var yValue = function(d) { return d.y; },
  yScale = d3.scaleLinear().range([height, 40]),  // inversion
  yMap1 = function(d) { return yScale(d.y1); },
  yMap2 = function(d) { return yScale(d.y2); },
  yMap = function(d) { return yScale(yValue(d)+0.4); };


var vis = d3.select("div#svg-timetree")
  .append("svg")
  .attr("width", width + margin.left + margin.right + padding.right);
  //.attr("height", height + margin.top + margin.bottom);
  //.append("g");

var vis_recombinant = d3.select("div#svg-recombinants")
  .append("svg")
  .attr("width", width + margin.left + margin.right + padding.right);

var axis = d3.select("div#svg-timetreeaxis")
  .append("svg")
  .attr("width", width + margin.left + margin.right + padding.right)
  .attr("height", 25)
  .append("g");

let cTooltip = d3.select("#tooltipContainer")
    .style("opacity", 0);

/**
 * Draw an open rectangle around the filled rectangle representing
 * a cluster/lineage in the time-scaled tree.
 * @param rect:  d3.Selection object
 */
function draw_cluster_box(rect) {
  var d = rect.datum();
  var rectWidth = xScale(date_to_xaxis(d.last_date)) - xScale(d.x2);

  if (d.label1[0] == 'X') {
    vis_recombinant.append("rect")
      .attr('class', "clickedH")
      .attr("x", function() {
        return xScale(date_to_xaxis(d.first_date)) - 2;
      })
      .attr("y", function() {
        return d.y*11;
      })
      .attr("width", function() {
        rectWidth = (xScale(date_to_xaxis(d.last_date)) - xScale(date_to_xaxis(d.first_date))) + 4;
        if (rectWidth < minRectWidth)
          return minRectWidth + 4
        return rectWidth
      })
      .attr("height", 14)
      .attr("fill", "white")
      .attr("stroke", "grey")
      .attr("fill-opacity", 1)
      .attr("stroke-width", 2);
  }
  else {
    // draw a box around the cluster rectangle
    vis.append("rect")
      .attr('class', "clickedH")
      .attr("x", xMap2(d) - 2)
      .attr("y", yMap(d) - 2)
      .attr("width", function() {
        if (rectWidth < minRectWidth)
          return minRectWidth + 4
        return xScale(date_to_xaxis(d.last_date)) - xScale(d.x2) + 4
      })
      .attr("height", 14)
      .attr("fill", "white")
      .attr("stroke", "grey")
      .attr("fill-opacity", 1)
      .attr("stroke-width", 2);
  }


  // move the box to the background by promoting other objects
  rect.raise();
  d3.select("#svg-timetree")
      .selectAll("line")
      .raise();
  d3.select("#svg-timetree")
      .selectAll("text")
      .raise();
}


/**
 * Draw time-scaled tree in SVG
 * @param {Array} df:  data frame
 */
function drawtree(df, org_df, redraw=true) {

  // Sets margin top to align vertical scrollbar with the time-scaled tree
  $('#tree-vscroll').css('margin-top', document.getElementById("tree-title").clientHeight + document.getElementById("svg-timetreeaxis").clientHeight + $('#inner-hscroll').height() + 5);
  $('#svg-timetreeaxis').css('padding-bottom', $('#inner-hscroll').height())

  var edgeset = edges(df, rectangular=true);

  // rescale SVG for size of tree
  var ntips = df.map(x => x.children.length === 0).reduce((x,y) => x+y);
  height = ntips*11 + margin.top + margin.bottom;
  vis.attr("height", height);
  yScale = d3.scaleLinear().range([height, 10]);  // add room for time axis

  // adjust d3 scales to data frame
  if(!redraw) {
    xScale.domain([
      d3.min(org_df, xValue)-0.05, 
      date_to_xaxis(d3.max(org_df, function(d) {return d.last_date})) 
    ]);
  }

  yScale.domain([
    d3.min(df, yValue)-1, d3.max(df, yValue)+1
  ]);

  // draw lines
  vis.selectAll("lines")
    .data(edgeset)
    .enter().append("line")
    .attr("class", "lines")
    .attr("x1", xMap1)
    .attr("y1", yMap1)
    .attr("x2", xMap2)
    .attr("y2", yMap2)
    .attr("stroke-width", 1.5)
    .attr("stroke", "#777");

    $('#tree-inner-vscroll').css('height', $('.tree-content > svg').height()); 
}


/**
 * Convert x-coordinate of tree scale to Date scale by referring to a
 * tip in the tree.  Code from:
 * https://stackoverflow.com/questions/563406/add-days-to-javascript-date
 *
 * @param x:  float, distance from root in tree (years)
 * @param tip:  Object, representing a reference tip in the tree
 * @returns {string}  new date in ISO format (yyyy-mm-dd)
 */
function xaxis_to_date(x, tip) {
  var coldate = new Date(tip.first_date);  // collection date of reference tip
  coldate = d3.timeDay.offset(coldate, 365.25*(x - tip.x));
  return (coldate.toISOString().split('T')[0]);
}


/**
 * Converts Date to x-coordinate of the tree scale
 * 
 * @param {Date} coldate
 * @returns {float} x-coordinate value 
 */
function date_to_xaxis(coldate) {
  var numDays = d3.timeDay.count(tips[0].first_date, coldate)
  return (numDays/365.25) + tips[0].x;
}


function mutations_to_string(mutations) {
  let mutStr = `<b>${i18n_text.tip_mutations}:</b><br/>`;
  for ([mutation, ] of mutations.slice(0,10)) {
    mutStr += `&nbsp;&nbsp;${mutation}<br/>`;
  }

  if (mutations.length > 10) {
    mutStr += `&nbsp;&nbsp;and ${mutations.length - 10} others...<br/>`
  }
  return mutStr;
}

function sort_mutations(mutations) {
  // Change dict to array 
  var mutations_array = Object.keys(mutations).map(function(key) {
    return [key, mutations[key]];
  });
  mutations_array.sort(function(first, second) {
    return second[1] - first[1]
  })
  return mutations_array
}

/**
 * Add subtree objects to time-scaled tree.
 * @param {Array} tips, clusters that have been mapped to tips of tree
 */
function draw_clusters(tips, recombinant_tips, redraw=false) {

  var tickVals = [],
      minVal = d3.min(df, xValue)-0.05,
      maxVal = date_to_xaxis(d3.max(df, function(d) {return d.last_date})),
      interval = (maxVal - minVal)/3;

  for (var i = 0; i < 3; i++) {
    tickVals.push(minVal + (interval/2) + (i*interval));
  }
  
  if(!redraw) {
    // Draws the axis for the time scaled tree
    axis.append("g")
    .attr("class", "treeaxis")
    .attr("transform", "translate(0,20)")
    .call(d3.axisTop(xScale)
      .ticks(3)
      .tickValues(tickVals)
      .tickFormat(function(d) {
        return xaxis_to_date(d, tips[0])
      })
    );
  }

  function mouseover(d) {
    d3.select("[cidx=cidx-" + d.cluster_idx + "]")
      .attr("txt_hover", "yes");

    cTooltip.transition()       // Show tooltip
            .duration(50)
            .style("opacity", 0.9);

    let ctooltipText = `<b>${i18n_text.tip_diffs}:</b> ${Math.round(100*d.mean_ndiffs)/100.}<br/>`;
    ctooltipText += `<b>${i18n_text.tip_residual}:</b> ${Math.round(100*d.residual)/100.}<br>`;
    ctooltipText += mutations_to_string(sort_mutations(d.mutations));
    ctooltipText += region_to_string(d.allregions);
    ctooltipText += `<b>${i18n_text.tip_varcount}:</b><br>`;
    ctooltipText += `&nbsp;&nbsp; ${i18n_text.sampled}: ${d.varcount}<br>`;
    ctooltipText += `&nbsp;&nbsp; ${i18n_text.displayed}: ${d.sampled_varcount}<br>`;
    ctooltipText += `<b>${i18n_text.tip_coldates}:</b><br>${formatDate(d.first_date)} / ${formatDate(d.last_date)}`;

    // Tooltip appears 10 pixels left of the cursor
    // Position tooltip based on the y-position of the cluster
    cTooltip.html(ctooltipText)
        .style("left", (d3.event.pageX + 15) + "px")
        .style("top", function(){
          if (d3.event.pageY > window.innerHeight/2) {
            return d3.event.pageY - cTooltip.node().getBoundingClientRect().height - 15 + "px";
          } else {
            return d3.event.pageY + 15 + "px";
          }
        });
  }

  vis.selectAll("rect")
    .data(tips)
    .enter()
    .lower()
    .append("rect")
    //.attr("selected", false)
    .attr("x", xMap2)
    .attr("y", yMap)
    .attr("width", function(d) {
      var rectWidth = xScale(date_to_xaxis(d.last_date)) - xScale(d.x2);
      if (rectWidth < minRectWidth)
        return minRectWidth;
      return rectWidth;
    })
    .attr("height", 10)
    .attr("class", "default")
    .attr("cidx", function(d) { return "cidx-" + d.cluster_idx; })
    .attr("id", function(d, i) { return "id-" + map_cidx_to_id['cidx-' + d.cluster_idx]; })
    .on('mouseover', mouseover)
    .on("mouseout", function() {
      d3.select(this)
        .attr("txt_hover", null);

      cTooltip.transition()     // Hide tooltip
          .duration(50)
          .style("opacity", 0);
    })
    .on("click", async function(d) {
      var cluster_info = this;
      $('#error_message').text(``);
      $("#loading").show();
      $("#loading_text").text(`Loading. Please Wait...`);
      await click_cluster(d, cluster_info);
      $("#loading").hide();
      $("#loading_text").text(``);
    });

  vis_recombinant
  .attr("height", recombinant_tips.length * 11.1)

  vis_recombinant.selectAll("rect")
    .data(recombinant_tips)
    .enter()
    .lower()
    .append("rect")
    //.attr("selected", false)
    .attr("x", function(d) {
      return xScale(date_to_xaxis(d.first_date))
    })
    .attr("y", function(d) {
      return d.y*11 + 2;
    })
    .attr("width", function(d) {
      var rectWidth = xScale(date_to_xaxis(d.last_date)) - xScale(date_to_xaxis(d.first_date));
      if (rectWidth < minRectWidth)
        return minRectWidth;
      return rectWidth;
    })
    .attr("height", 10)
    .attr("class", "default recombinant")
    .attr("cidx", function(d) { return "cidx-" + d.cluster_idx; })
    .attr("id", function(d, i) { return "id-" + map_cidx_to_id['cidx-' + d.cluster_idx]; })
    .on('mouseover', mouseover)
    .on("mouseout", function() {
      d3.select(this)
        .attr("txt_hover", null);

      cTooltip.transition()     // Hide tooltip
          .duration(50)
          .style("opacity", 0);
    })
    .on("click", async function(d) {
      var cluster_info = this;
      $('#error_message').text(``);
      $("#loading").show();
      $("#loading_text").text(`Loading. Please Wait...`);
      await click_cluster(d, cluster_info);
      $("#loading").hide();
      $("#loading_text").text(``);
    });

  // generate colour palettes
  sample_pal = d3.scaleSequential(d3.interpolatePuBu)
      .domain(d3.extent(tips, function(d) { return Math.log10(d.nsamples); }));
  coldate_pal = d3.scaleSequential(d3.interpolateCividis)
      .domain(d3.extent(tips, function(d) { return d.last_date; }));
  diverge_pal = d3.scaleSequential(d3.interpolatePlasma)
      .domain(d3.extent(tips, function(d) { return d.residual; }));
  generate_legends();
  changeTreeColour();

  d3.select("#svg-timetree")
  .selectAll("line")
  .raise();

  vis.selectAll("text")
      .data(tips)
      .enter().append("text")
      .style("font-size", "10px")
      .attr("text-anchor", "start")
      .attr("alignment-baseline", "middle")
      .attr("cursor", "default")
      .attr("id", function(d) { return "cidx-" + d.cluster_idx; })
      .attr("x", function(d) {
        var rectWidth = xScale(date_to_xaxis(d.last_date)) - xScale(d.x2);
        if (rectWidth < minRectWidth)
          return xScale(d.x2) + minRectWidth + 3;
        return xScale(d.x2) + rectWidth + 3;
      })
      .attr("y", function(d) {
        return(yScale(d.y-0.15));
      })
      .text(function(d) { return(d.label1); })
      .on("mouseover", function(d) {
	      mouseover(d);
      })
      .on("mouseout", function(d) {
        d3.select("[cidx=cidx-" + d.cluster_idx + "]").dispatch('mouseout');
      })
      .on("click", function(d) {
        d3.select("[cidx=cidx-" + d.cluster_idx + "]").dispatch('click');
      });

    vis_recombinant.selectAll("text")
      .data(recombinant_tips)
      .enter().append("text")
      .style("font-size", "10px")
      .attr("text-anchor", "start")
      .attr("alignment-baseline", "middle")
      .attr("cursor", "default")
      .attr("id", function(d) { return "cidx-" + d.cluster_idx; })
      .attr("x", function(d) {
        var rectWidth = xScale(date_to_xaxis(d.last_date)) - xScale(date_to_xaxis(d.first_date));
        if (rectWidth < minRectWidth)
          return xScale(date_to_xaxis(d.first_date)) + minRectWidth + 3;
        return xScale(date_to_xaxis(d.first_date)) + rectWidth + 3;
      })
      .attr("y", function(d) {
        // return(yScale(d.y-0.15));
        return d.y*11 + 7;
      })
      .text(function(d) { return(d.label1); })
      .on("mouseover", function(d) {
	      mouseover(d);
      })
      .on("mouseout", function(d) {
        d3.select("[cidx=cidx-" + d.cluster_idx + "]").dispatch('mouseout');
      })
      .on("click", function(d) {
        d3.select("[cidx=cidx-" + d.cluster_idx + "]").dispatch('click');
      });
}


/**
 * Colour rect elements of tree to represent lineage attributes
 */
function changeTreeColour() {
  // hide legends, not knowing which one is showing
  $("#div-region-legend").hide();
  $("div#svg-sample-legend").hide();
  $("div#svg-coldate-legend").hide();
  $("div#svg-diverge-legend").hide();

  vis.selectAll("rect")
      .transition()
      .duration(300)
      .style("fill", function(d) {
        if (d !== undefined) {
          let opt = $("#select-tree-colours").val();
          if (opt === "Region") {
            $("#div-region-legend").show();
            return(country_pal[d.region]);
          }
          else if (opt === "No. samples") {
            $("div#svg-sample-legend").show();
            return(sample_pal(Math.log10(d.nsamples)));  // placeholder values
          }
          else if (opt === "Collection date") {
            $("div#svg-coldate-legend").show();
            return(coldate_pal(d.last_date));
          }
          else {  // Divergence
            $("div#svg-diverge-legend").show();
            return(diverge_pal(d.residual));
          }
        }
      })

    vis_recombinant.selectAll("rect")
      .transition()
      .duration(300)
      .style("fill", function(d) {
        if (d !== undefined) {
          let opt = $("#select-tree-colours").val();
          if (opt === "Region") {
            $("#div-region-legend").show();
            return(country_pal[d.region]);
          }
          else if (opt === "No. samples") {
            $("div#svg-sample-legend").show();
            return(sample_pal(Math.log10(d.nsamples)));  // placeholder values
          }
          else if (opt === "Collection date") {
            $("div#svg-coldate-legend").show();
            return(coldate_pal(d.last_date));
          }
          else {  // Divergence
            $("div#svg-diverge-legend").show();
            return(diverge_pal(d.residual));
          }
        }
      })
}

// bind to element
$("#select-tree-colours").change(function() {
  changeTreeColour();
});


// from https://observablehq.com/@d3/color-legend
function legend({
  color,
  title,
  tickSize = 6,
  width = 320,
  height = 44 + tickSize,
  marginTop = 18,
  marginRight = 0,
  marginBottom = 16 + tickSize,
  marginLeft = 0,
  ticks = width / 64,
  tickFormat,
  tickValues
} = {}) {
  const svg = d3.create("svg")
      .attr("width", width)
      .attr("height", height)
      .attr("viewBox", [0, 0, width, height])
      .style("overflow", "visible")
      .style("display", "block");

  let tickAdjust = g => g.selectAll(".tick line").attr("y1", marginTop + marginBottom - height);
  let x;

  // Continuous
  if (color.interpolate) {
    const n = Math.min(color.domain().length, color.range().length);

    x = color.copy().rangeRound(d3.quantize(d3.interpolate(marginLeft, width - marginRight), n));

    svg.append("image")
        .attr("x", marginLeft)
        .attr("y", marginTop)
        .attr("width", width - marginLeft - marginRight)
        .attr("height", height - marginTop - marginBottom)
        .attr("preserveAspectRatio", "none")
        .attr("xlink:href", ramp(color.copy().domain(d3.quantize(d3.interpolate(0, 1), n))).toDataURL());
  }

  // Sequential
  else if (color.interpolator) {
    x = Object.assign(color.copy()
        .interpolator(d3.interpolateRound(marginLeft, width - marginRight)),
        {range() { return [marginLeft, width - marginRight]; }});

    svg.append("image")
        .attr("x", marginLeft)
        .attr("y", marginTop)
        .attr("width", width - marginLeft - marginRight)
        .attr("height", height - marginTop - marginBottom)
        .attr("preserveAspectRatio", "none")
        .attr("xlink:href", ramp(color.interpolator()).toDataURL());

    // scaleSequentialQuantile doesn’t implement ticks or tickFormat.
    if (!x.ticks) {
      if (tickValues === undefined) {
        const n = Math.round(ticks + 1);
        tickValues = d3.range(n).map(i => d3.quantile(color.domain(), i / (n - 1)));
      }
      if (typeof tickFormat !== "function") {
        tickFormat = d3.format(tickFormat === undefined ? ",f" : tickFormat);
      }
    }
  }

  // Threshold
  else if (color.invertExtent) {
    const thresholds
        = color.thresholds ? color.thresholds() // scaleQuantize
        : color.quantiles ? color.quantiles() // scaleQuantile
        : color.domain(); // scaleThreshold

    const thresholdFormat
        = tickFormat === undefined ? d => d
        : typeof tickFormat === "string" ? d3.format(tickFormat)
        : tickFormat;

    x = d3.scaleLinear()
        .domain([-1, color.range().length - 1])
        .rangeRound([marginLeft, width - marginRight]);

    svg.append("g")
      .selectAll("rect")
      .data(color.range())
      .join("rect")
        .attr("x", (d, i) => x(i - 1))
        .attr("y", marginTop)
        .attr("width", (d, i) => x(i) - x(i - 1))
        .attr("height", height - marginTop - marginBottom)
        .attr("fill", d => d);

    tickValues = d3.range(thresholds.length);
    tickFormat = i => thresholdFormat(thresholds[i], i);
  }

  // Ordinal
  else {
    x = d3.scaleBand()
        .domain(color.domain())
        .rangeRound([marginLeft, width - marginRight]);

    svg.append("g")
      .selectAll("rect")
      .data(color.domain())
      .join("rect")
        .attr("x", x)
        .attr("y", marginTop)
        .attr("width", Math.max(0, x.bandwidth() - 1))
        .attr("height", height - marginTop - marginBottom)
        .attr("fill", color);

    tickAdjust = () => {};
  }

  svg.append("g")
      .attr("transform", `translate(0,${height - marginBottom})`)
      .call(d3.axisBottom(x)
        .ticks(ticks, typeof tickFormat === "string" ? tickFormat : undefined)
        .tickFormat(typeof tickFormat === "function" ? tickFormat : undefined)
        .tickSize(tickSize)
        .tickValues(tickValues))
      .call(tickAdjust)
      .call(g => g.select(".domain").remove())
      .call(g => g.append("text")
        .attr("x", marginLeft)
        .attr("y", marginTop + marginBottom - height - 6)
        .attr("fill", "currentColor")
        .attr("text-anchor", "start")
        .attr("font-weight", "bold")
        .attr("class", "title")
        .text(title));

  return svg.node();
}


function ramp(color, n = 256) {
  // https://stackoverflow.com/questions/60443356/legend-not-appearing-when-using-document-createelementcanvas
  const canvas = document.createElement('canvas');
  const context = canvas.getContext("2d");
  d3.select(canvas).attr("width", n)
    .attr("height", 1);
  for (let i = 0; i < n; ++i) {
    context.fillStyle = color(i / (n - 1));
    context.fillRect(i, 0, 1, 1);
  }
  return canvas;
}


function generate_legends() {
  // region legend with swatches
  let s = `<div style="display: flex; align-items: center; margin-left: 0px; padding-top: 6px; min-height: 33px; font: 10px sans-serif;">`;
  s += `<div style="width: 100%; columns: 60px;">`;
  for (const [key, value] of Object.entries(country_pal)) {
    let region = i18n_text.region_legend[key];
    s += `<div class="legend-item">`;
    s += `<div class="legend-swatch" style="background:${value};"></div>`;
    s += `<div class="legend-label" title="${region}">${region}</div>`;
    s += `</div>`;
  }
  s += `</div></div>`;
  $("#div-region-legend").html(s).hide();

  // sample size legend
  $("div#svg-sample-legend").html(legend({
    color: sample_pal,
    title: i18n_text.sample_legend,
    width: 240
  })).hide();

  // collection date legend
  var [millsec0, millsec1] = coldate_pal.domain(),
      days = (millsec1 - millsec0) / 8.64e7;
  $("div#svg-coldate-legend").html(legend({
    color: d3.scaleSequential([-days, 0], d3.interpolateCividis),
    title: i18n_text.coldate_legend,
    width: 240
  })).hide();

  // divergence legend
  $("div#svg-diverge-legend").html(legend({
    color: diverge_pal,
    title: i18n_text.diverge_legend,
    width: 240
  })).hide();
}


async function click_cluster(d, cluster_info) {
  cindex = d.cluster_idx;  // store index as global variable
  d3.selectAll("rect.clickedH").remove();

  // Remove "clicked" class to ensure that the previous cluster doesn't remain highligted
  if (search_results.get().total_points > 0 || isLineage($('#search-input').val())) {
    d3.selectAll(".SelectedCluster.clicked").attr('class', 'SelectedCluster'); 
    d3.selectAll("rect.clicked").attr('class', "not_SelectedCluster");
    d3.selectAll("text.clicked").attr('class', null);
  }
  else
    d3.selectAll("rect.clicked").attr('class', "default");
    d3.selectAll("text.clicked").attr('class', null);
    
  await beadplot(d.cluster_idx);

  // reset all rectangles to high transparency
  if ($('#search-input').val() === "") {
    vis.selectAll("rect.clicked").attr('class', "default");
    vis.selectAll("text.clicked").attr('class', null);
  }


  if (isLineage($('#search-input').val())) {
    if (cluster_info.className.baseVal !== "SelectedCluster"){
      deselect_all_beads();
      d3.select(cluster_info).attr("class", "not_SelectedCluster clicked");
      d3.select("#cidx-" + cindex).attr("class", "clicked");
    }

    gentable(d);
    draw_region_distribution(d.allregions);
    gen_details_table(points);  // update details table with all samples
    gen_mut_table(mutations[d.cluster_idx]);
  }
  else if (cluster_info.className.baseVal !== "SelectedCluster"){
    if (search_results.get().total_points > 0) {
      var hit_ids = search_results.get().hit_ids;
      var closest_cluster = previous_closest_match('cidx-'+d.cluster_idx, hit_ids);
      var bead_id;

      if (hit_ids[0] == hit_ids[hit_ids.length - 1] && map_cidx_to_id["cidx-"+cindex] < hit_ids[0])
        bead_id = (search_results.get().clusters_last_bead)[id_to_cidx[closest_cluster]];
      else if (map_cidx_to_id["cidx-"+cindex] > hit_ids[hit_ids.length - 1])
        bead_id = (search_results.get().clusters_first_bead)[id_to_cidx[closest_cluster]];
      else
        bead_id = (search_results.get().clusters_last_bead)[id_to_cidx[closest_cluster]];

      deselect_all_beads();

      var stats = search_results.update({
        current_point: (search_results.get().beads)[bead_id]
      });
      update_search_stats(stats);
      d3.select(cluster_info).attr("class", "not_SelectedCluster clicked");
      d3.select("#cidx-" + cindex).attr("class", "clicked");
    }
    else 
      d3.select(cluster_info).attr("class", "clicked");
      d3.select("#cidx-" + cindex).attr("class", "clicked");

    $("#barplot").text(null);

    gentable(d);
    draw_region_distribution(d.allregions);
    gen_details_table(points);  // update details table with all samples
    gen_mut_table(mutations[d.cluster_idx]);
    
    // FIXME: this is the same div used for making barplot SVG
    $("#text-node").html(`Number of cases: ${d.count}<br/>Number of variants: ${d.varcount}<br/>`);
  }
  else {
    // If the selected cluster is a SelectedCluster, then the search_results need to be updated to point to the first bead in the cluster
    d3.select(cluster_info).attr("class", "SelectedCluster clicked");
    d3.select("#cidx-" + cindex).attr("class", "clicked");
    var bead_hits = search_results.get().beads;
    var current_id = (search_results.get().clusters_first_bead)['cidx-' + d.cluster_idx]
    var bead_id_to_accession = Object.keys(bead_hits);
    var stats = search_results.update({
      current_point: bead_hits[current_id]
    });
    update_search_stats(stats);
    // Beads in Cluster
    points_ui = d3.selectAll("#svg-cluster > svg > g > circle")
    .filter(function(d) {
      return bead_id_to_accession.includes(d.accessions[0])
    });

    selected = points_ui.nodes();
    deselect_all_beads();
    for (const node of selected) {
      selected_obj = d3.select(node);
      create_selection(selected_obj);
    }

    var select_bead = d3.selectAll('circle[id="'+current_id+'"]');
    select_bead.raise();
    var working_bead = select_bead.nodes()[0];
    working_bead.scrollIntoView({block: "center"});
    update_table_individual_bead_front(d3.select(working_bead).datum());
  }
  draw_cluster_box(d3.select(cluster_info));
}

async function redraw_tree(cutoff_date, redraw=true, partial_redraw=false) {
  // deep copy the df and clear all references to children
  df_copy = structuredClone(df);

  var df_copy = df_copy.map(x => {
    x.children = [];
    return x;
  });

  // filter for tips with a collection date after the cutoff
  var filtered_df = df_copy.filter(x => {
    if (formatDate(x.coldate) >= cutoff_date && x.isTip == true) return x;
  });

  if(filtered_df.length > 0) {
    // add internal nodes corresponding to filtered tips
    filtered_df.forEach(function(node) {
      let filtered_node = df_copy[node.parentId];
      let child = node;
      while((filtered_node != undefined)) {
        if((!filtered_df.includes(filtered_node))) {
          filtered_df.push(filtered_node);
        }
        if(!filtered_node.children.includes(child.thisId)) {
          filtered_node.children.push(child.thisId);
        }
        child = filtered_node;
        filtered_node = df_copy[filtered_node.parentId];
      }
    })
    // sort by ids
    filtered_df = filtered_df.sort(function(a, b) {
      return a.thisId - b.thisId;
    })

    var final_df = []
    // filter out internal nodes with only one child
    for(var node of filtered_df) {
      if(node.children.length > 1 || node.isTip) {
        final_df.push(node)
      }
      else {
        while((node.parentId != undefined) && (node.children.length == 1)) {
          parent = df_copy[node.parentId];
          child = df_copy[node.children[0]];

          child.parentId = node.parentId;
          child.parentLabel = node.parentLabel;
          let index = parent.children.findIndex(x => x == node.thisId);
          parent.children.splice(index, 1, node.children[0]);

          node = parent;
        }
      }
    }

    // map new ids to the old ids and reassign parents/children
    map_ids = {}
    final_df.forEach(function (node, i) {
      map_ids[node.thisId] = i;
      final_df[i].thisId = i;
    });
    final_df.forEach(function (node) {
      let new_children = [];
      for(const child of node.children) {
        new_children.push(map_ids[child])
      }
      node.parentId = map_ids[node.parentId] ? map_ids[node.parentId] : null;
      node.children = new_children;
    });

    // recalculate y coordinates
    var counter = 0;
    final_df.forEach(function (node) {
      if(node.isTip) node.y = counter++;
      else {
        node.y = 0;
        for (var i = 0; i < node.children.length; i++) {
          node.y += final_df[node.children[i]].y;
        }
        node.y /= node.children.length;
      }
    })
  }
  else {
    final_df = df;
  }

  var filtered_tips = final_df.filter(x => {
    if (x.isTip == true) return x;
  });

  var filtered_recomb_tips = recombinant_tips.filter(x => {
    if (formatDate(x.coldate) >= cutoff_date) return x;
  });

  filtered_recomb_tips.forEach(function(x,i) {
    x.y = i   
  })

  if (filtered_recomb_tips.length === 0) {
    $(".recombinant-tree-content").hide()
    $(".recombtitle").hide()
  }
  else if ($('#display-option').attr('checked')) {
    $(".recombinant-tree-content").show()
    $(".recombtitle").show()
  }


  document.querySelector("#svg-timetree > svg").innerHTML = ''; 
  document.querySelector("#svg-recombinants > svg").innerHTML = '';
  if (partial_redraw) {
    drawtree(final_df, df_copy, redraw=partial_redraw);
    draw_clusters(filtered_tips, filtered_recomb_tips, partial_redraw);
  }
  else {
    drawtree(final_df, df_copy, redraw=redraw);
    draw_clusters(filtered_tips, filtered_recomb_tips, redraw);
  }

  if(redraw && !partial_redraw) {
    var rect = d3.selectAll("#svg-timetree > svg > rect"),
    node = rect.nodes()[rect.size()-1];

    cindex = node.__data__.cluster_idx;
    d3.select('#cidx-' + cindex).attr("class", "clicked");
    draw_cluster_box(d3.select(node));

    
    await beadplot(cindex);
    gentable(node.__data__);
    draw_region_distribution(node.__data__.allregions);
    gen_details_table(points);  // update details table with all samples
    gen_mut_table(mutations[cindex]);
  }
}

function reset_tree(partial_redraw=false) {
  // resets slider and tree 
  min = $("#tree-slider").slider("option").min; 
  min_date = formatDate(d3.min(df, function(d) {return d.last_date}));

  $("#tree-slider").slider('value', min);
  $("#cutoff-date").text(min_date);
  $("#tree-cutoff").css('left',  $("#tree-slider-handle").position().left);
  $("#tree-slider").slider({ disabled: true});
  redraw_tree(min_date, redraw=true, partial_redraw=partial_redraw);
  if (partial_redraw) d3.select('#cidx-' + cindex).attr("class", "clicked");
}