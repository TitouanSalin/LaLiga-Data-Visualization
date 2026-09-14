// Liste des fichiers CSV
const seasons = [
    'season-0506.csv', 'season-0607.csv', 'season-0708.csv', 'season-0809.csv',
    'season-0910.csv', 'season-1011.csv', 'season-1112.csv', 'season-1213.csv',
    'season-1314.csv', 'season-1415.csv', 'season-1516.csv', 'season-1617.csv',
    'season-1718.csv', 'season-1819.csv', 'season-1920.csv', 'season-2021.csv',
    'season-2122.csv', 'season-2223.csv', 'season-2324.csv', 'season-2425.csv'
];

// Fonction pour charger un CSV
async function loadCSV(file) {
    const response = await fetch(`data/${file}`);
    const text = await response.text();
    return d3.csvParse(text);
}

// Charger toutes les données
async function loadAllData() {
    const promises = seasons.map(season => loadCSV(season));
    const dataArrays = await Promise.all(promises);
    return dataArrays.map((data, i) => ({
        season: seasons[i].replace('season-', '').replace('.csv', ''),
        data: data
    }));
}

function formatSeasonLabel(seasonCode) {
    // 0506 -> 2005/06
    const start = seasonCode.substring(0, 2);
    const end = seasonCode.substring(2, 4);
    return `'${start}/${end}`;
}

// Constantes d'opacité
const OPACITY_LOW = 0.1;
const OPACITY_MID = 0.5;
const OPACITY_HIGH = 1.0;

// État global
const selectedTeams = new Set();
const teamColors = {};
const activeLegacies = new Set(); // Contient 'messi', 'ronaldo' ou les deux

function assignTeamColors(allData) {
    const teams = new Set();
    allData.forEach(season => {
        season.data.forEach(match => {
            if (match.HomeTeam) teams.add(match.HomeTeam);
            if (match.AwayTeam) teams.add(match.AwayTeam);
        });
    });

    const sortedTeams = Array.from(teams).sort();
    // Utiliser une palette de couleurs plus large
    const colorScale = d3.scaleOrdinal(d3.schemeTableau10); 

    sortedTeams.forEach((team) => {
        teamColors[team] = colorScale(team);
    });
    
    // Surcharges manuelles pour les couleurs emblématiques
    teamColors["Real Madrid"] = "#f7f77aff"; 
    teamColors["Barcelona"] = "#DB0030"; 
}

function updateChartsOpacity() {
    const isSelectionEmpty = selectedTeams.size === 0;

    const getOpacity = (teamName) => {
        if (isSelectionEmpty) return OPACITY_HIGH;
        return selectedTeams.has(teamName) ? OPACITY_HIGH : OPACITY_LOW;
    };

    // Mise à jour générique pour tous les éléments avec data-team-name
    d3.selectAll(".team-element").each(function() {
        const element = d3.select(this);
        const teamName = element.attr("data-team-name");
        
        if (teamName) {
            const targetOpacity = getOpacity(teamName);
            
            // Gestion spécifique selon le type d'élément
            if (element.classed("bump-line")) {
                element.transition().duration(300)
                    .style("stroke-opacity", targetOpacity)
                    .style("stroke-width", selectedTeams.has(teamName) ? 5 : 1.5);
            } else if (element.classed("evolution-line")) {
                element.transition().duration(300)
                    .style("stroke-opacity", targetOpacity)
                    .attr("stroke-width", selectedTeams.has(teamName) ? 4 : 1.5);
            } else {
                element.transition().duration(300).style("opacity", targetOpacity);
            }
        }
    });

    // Mise à jour spécifique pour les liens du graphique circulaire (Zone 2)
    d3.selectAll(".match-link").transition().duration(300).style("opacity", function(d) {
        if (!d) return 0.4; // Sécurité
        if (isSelectionEmpty) return 0.4; // Opacité par défaut
        
        // Si une des deux équipes est sélectionnée, on met en évidence
        if (selectedTeams.has(d.home) || selectedTeams.has(d.away)) {
            return 0.8;
        }
        return 0.05; // Sinon on estompe fortement
    });
}

function toggleTeamSelection(teamName) {
    if (selectedTeams.has(teamName)) {
        selectedTeams.delete(teamName);
    } else {
        selectedTeams.add(teamName);
    }
    
    // Sync List UI
    document.querySelectorAll('.team-list-item').forEach(item => {
        if (item.textContent === teamName) {
            if (selectedTeams.has(teamName)) {
                item.classList.add('selected');
                item.style.backgroundColor = '#e0e0e0';
                item.style.fontWeight = 'bold';
            } else {
                item.classList.remove('selected');
                item.style.backgroundColor = 'transparent';
                item.style.fontWeight = 'normal';
            }
        }
    });

    updateChartsOpacity();
}

// --- Helpers ---

function setupChartSVG(containerId, margin, width, height) {
    let svg = d3.select(containerId).select("svg");
    let g;

    if (svg.empty()) {
        svg = d3.select(containerId)
            .append("svg")
            .attr("viewBox", `0 0 ${width + margin.left + margin.right} ${height + margin.top + margin.bottom}`)
            .attr("preserveAspectRatio", "xMidYMid meet")
            .style("width", "100%")
            .style("height", "100%");
        
        g = svg.append("g")
            .attr("transform", `translate(${margin.left},${margin.top})`);
    } else {
        g = svg.select("g");
    }
    return { svg, g };
}

function getTooltip(className) {
    return d3.select("body").selectAll("." + className).data([0]).join("div")
        .attr("class", "tooltip " + className)
        .style("opacity", 0)
        .style("position", "absolute")
        .style("background", "#000000CC")
        .style("color", "white")
        .style("padding", "5px")
        .style("border-radius", "4px")
        .style("pointer-events", "none")
        .style("font-size", "12px");
}

// --- Graphique 2 : Matrice d'Efficacité ---
function processEfficiencyData(seasonData) {
    const teams = {};

    seasonData.data.forEach(match => {
        const home = match.HomeTeam;
        const away = match.AwayTeam;

        if (!teams[home]) teams[home] = { name: home, goals: 0, shots: 0, points: 0, matches: 0 };
        if (!teams[away]) teams[away] = { name: away, goals: 0, shots: 0, points: 0, matches: 0 };

        teams[home].goals += parseInt(match.FTHG || 0);
        teams[home].shots += parseInt(match.HS || 0);
        teams[home].matches += 1;
        if (match.FTR === 'H') teams[home].points += 3;
        else if (match.FTR === 'D') teams[home].points += 1;

        teams[away].goals += parseInt(match.FTAG || 0);
        teams[away].shots += parseInt(match.AS || 0);
        teams[away].matches += 1;
        if (match.FTR === 'A') teams[away].points += 3;
        else if (match.FTR === 'D') teams[away].points += 1;
    });

    return Object.values(teams).map(team => ({
        name: team.name,
        goalsPerMatch: team.goals / team.matches,
        shotsPerMatch: team.shots / team.matches,
        totalPoints: team.points
    }));
}

function createEfficiencyChart(data) {
    const margin = {top: 40, right: 40, bottom: 50, left: 60};
    const width = 800 - margin.left - margin.right;
    const height = 500 - margin.top - margin.bottom;

    const { svg, g } = setupChartSVG("#efficiency-chart", margin, width, height);

    if (svg.select(".x-axis").empty()) {
        g.append("g").attr("class", "x-axis").attr("transform", `translate(0,${height})`);
        g.append("g").attr("class", "y-axis");
        
        g.append("line").attr("class", "avg-x-line").attr("stroke", "#ccc").attr("stroke-dasharray", "4");
        g.append("line").attr("class", "avg-y-line").attr("stroke", "#ccc").attr("stroke-dasharray", "4");

        g.append("text")
            .attr("text-anchor", "end")
            .attr("x", width)
            .attr("y", height + 40)
            .text("Shots per Match")
            .style("fill", "#666")
            .style("font-size", "20px");

        g.append("text")
            .attr("text-anchor", "end")
            .attr("transform", "rotate(-90)")
            .attr("y", -40)
            .attr("x", 0)
            .text("Goals per Match")
            .style("fill", "#666")
            .style("font-size", "20px");
    }

    const x = d3.scaleLinear()
        .domain([d3.min(data, d => d.shotsPerMatch) * 0.9, d3.max(data, d => d.shotsPerMatch) * 1.1])
        .range([0, width]);

    const y = d3.scaleLinear()
        .domain([d3.min(data, d => d.goalsPerMatch) * 0.9, d3.max(data, d => d.goalsPerMatch) * 1.1])
        .range([height, 0]);

    const z = d3.scaleLinear()
        .domain([d3.min(data, d => d.totalPoints), d3.max(data, d => d.totalPoints)])
        .range([5, 25]);

    const avgShots = d3.mean(data, d => d.shotsPerMatch);
    const avgGoals = d3.mean(data, d => d.goalsPerMatch);

    const t = d3.transition().duration(750);

    g.select(".x-axis").transition(t).call(d3.axisBottom(x));
    g.select(".y-axis").transition(t).call(d3.axisLeft(y));

    g.select(".avg-x-line").transition(t)
        .attr("x1", x(avgShots)).attr("x2", x(avgShots))
        .attr("y1", 0).attr("y2", height);

    g.select(".avg-y-line").transition(t)
        .attr("x1", 0).attr("x2", width)
        .attr("y1", y(avgGoals)).attr("y2", y(avgGoals));

    const tooltip = getTooltip("tooltip-scatter");

    // Update circles
    g.selectAll("circle")
        .data(data, d => d.name)
        .join(
            enter => enter.append("circle")
                .attr("class", "team-element")
                .attr("data-team-name", d => d.name)
                .attr("cx", d => x(d.shotsPerMatch))
                .attr("cy", d => y(d.goalsPerMatch))
                .attr("r", 0)
                .style("fill", d => teamColors[d.name] || "#3498db")
                .style("opacity", d => (selectedTeams.size === 0 || selectedTeams.has(d.name)) ? OPACITY_HIGH : OPACITY_LOW)
                .style("stroke", "white")
                .call(enter => enter.transition(t)
                    .attr("r", d => z(d.totalPoints))),
            update => update.transition(t)
                .attr("cx", d => x(d.shotsPerMatch))
                .attr("cy", d => y(d.goalsPerMatch))
                .attr("r", d => z(d.totalPoints))
                .style("fill", d => teamColors[d.name] || "#3498db")
                .style("opacity", d => (selectedTeams.size === 0 || selectedTeams.has(d.name)) ? OPACITY_HIGH : OPACITY_LOW),
            exit => exit.transition(t).attr("r", 0).remove()
        )
        .on("mouseover", function(event, d) {
            d3.select(this).style("stroke", "#333");
            tooltip.transition().duration(200).style("opacity", 0.9);
            tooltip.html(`
                <strong>${d.name}</strong><br/>
                Points: ${d.totalPoints}<br/>
                Goals/Match: ${d.goalsPerMatch.toFixed(2)}<br/>
                Shots/Match: ${d.shotsPerMatch.toFixed(2)}
            `)
            .style("left", (event.pageX + 10) + "px")
            .style("top", (event.pageY - 28) + "px");
        })
        .on("mouseout", function(event, d) {
            d3.select(this).style("stroke", "white");
            tooltip.transition().duration(500).style("opacity", 0);
        })
        .on("click", function(event, d) {
            toggleTeamSelection(d.name);
        });

    // Update labels
    g.selectAll(".team-label")
        .data(data, d => d.name)
        .join(
            enter => enter.append("text")
                .attr("class", "team-label")
                .attr("x", d => x(d.shotsPerMatch))
                .attr("y", d => y(d.goalsPerMatch) - z(d.totalPoints) - 5)
                .text(d => d.name)
                .style("font-size", "10px")
                .style("fill", "#333")
                .style("text-anchor", "middle")
                .style("pointer-events", "none")
                .style("opacity", 0)
                .call(enter => enter.transition(t).style("opacity", 1)),
            update => update.transition(t)
                .attr("x", d => x(d.shotsPerMatch))
                .attr("y", d => y(d.goalsPerMatch) - z(d.totalPoints) - 5)
                .style("opacity", d => (Math.abs(d.shotsPerMatch - avgShots) > 2 || Math.abs(d.goalsPerMatch - avgGoals) > 0.5 || d.totalPoints > 80) ? 1 : 0),
            exit => exit.transition(t).style("opacity", 0).remove()
        );
}

// --- Graphique 3 : Bump Chart ---
function processRankingsData(allData) {
    const allRankings = [];
    const teamsSet = new Set();

    allData.forEach(seasonData => {
        const teams = {};
        
        seasonData.data.forEach(match => {
            const home = match.HomeTeam;
            const away = match.AwayTeam;

            if (!teams[home]) teams[home] = { name: home, points: 0, gd: 0, goals: 0 };
            if (!teams[away]) teams[away] = { name: away, points: 0, gd: 0, goals: 0 };

            const hg = parseInt(match.FTHG || 0);
            const ag = parseInt(match.FTAG || 0);

            teams[home].goals += hg;
            teams[home].gd += (hg - ag);
            
            teams[away].goals += ag;
            teams[away].gd += (ag - hg);

            if (match.FTR === 'H') teams[home].points += 3;
            else if (match.FTR === 'D') {
                teams[home].points += 1;
                teams[away].points += 1;
            } else if (match.FTR === 'A') teams[away].points += 3;
        });

        const sortedTeams = Object.values(teams).sort((a, b) => {
            if (b.points !== a.points) return b.points - a.points;
            if (b.gd !== a.gd) return b.gd - a.gd;
            return b.goals - a.goals;
        });

        sortedTeams.forEach((team, index) => {
            allRankings.push({
                season: formatSeasonLabel(seasonData.season),
                rawSeason: seasonData.season,
                team: team.name,
                rank: index + 1
            });
            teamsSet.add(team.name);
        });
    });

    const allSeasonsLabels = allData.map(d => formatSeasonLabel(d.season));

    const teamsData = Array.from(teamsSet).map(teamName => {
        const teamRankings = allRankings.filter(d => d.team === teamName);
        const rankMap = new Map(teamRankings.map(r => [r.season, r]));
        
        const fullValues = allSeasonsLabels.map(seasonLabel => {
            if (rankMap.has(seasonLabel)) {
                return rankMap.get(seasonLabel);
            }
            return {
                season: seasonLabel,
                team: teamName,
                rank: null // Indicates missing
            };
        });

        return {
            name: teamName,
            values: fullValues
        };
    });

    return { teamsData, seasons: allSeasonsLabels };
}

function createBumpChart(data, currentSeasonIndex) {
    d3.select("#bump-chart").selectAll("*").remove();

    const margin = {top: 40, right: 100, bottom: 50, left: 50};
    const width = 1000 - margin.left - margin.right;
    const height = 550 - margin.top - margin.bottom;

    const svg = d3.select("#bump-chart")
        .append("svg")
        .attr("viewBox", `0 0 ${width + margin.left + margin.right} ${height + margin.top + margin.bottom}`)
        .attr("preserveAspectRatio", "xMidYMid meet")
        .style("width", "100%")
        .style("height", "100%")
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    const seasons = data.seasons;
    
    const x = d3.scalePoint()
        .domain(seasons)
        .range([0, width])
        .padding(0.5);

    const y = d3.scaleLinear()
        .domain([1, 20])
        .range([0, height]);

    // --- Patterns pour le highlight ---
    const defs = svg.append("defs");

    // Pattern Messi (Barcelona)
    defs.append("pattern")
        .attr("id", "pattern-messi")
        .attr("patternUnits", "userSpaceOnUse")
        .attr("width", 8)
        .attr("height", 8)
        .append("path")
        .attr("d", "M-1,1 l2,-2 M0,8 l8,-8 M7,9 l2,-2")
        .attr("stroke", teamColors["Barcelona"] || "#ecf0f1")
        .attr("stroke-width", 1.5)
        .attr("opacity", 0.3);

    // Pattern Ronaldo (Real Madrid)
    defs.append("pattern")
        .attr("id", "pattern-ronaldo")
        .attr("patternUnits", "userSpaceOnUse")
        .attr("width", 8)
        .attr("height", 8)
        .append("path")
        .attr("d", "M-1,7 l2,2 M0,0 l8,8 M7,-1 l2,2")
        .attr("stroke", "#bfbf5eff")
        .attr("stroke-width", 1.5)
        .attr("opacity", 0.5);

    // --- Highlight Legacy ---
    if (activeLegacies.has('messi')) {
        // 2004-2021 -> "0506" (start of data) to "2021"
        const startSeason = formatSeasonLabel("0506"); 
        const endSeason = formatSeasonLabel("2021");
        
        const xStart = x(startSeason);
        const xEnd = x(endSeason);
        
        if (xStart !== undefined && xEnd !== undefined) {
             svg.append("rect")
                .attr("x", xStart)
                .attr("y", 0)
                .attr("width", xEnd - xStart)
                .attr("height", height)
                .attr("fill", "url(#pattern-messi)")
                .style("pointer-events", "none");
        }
    } 
    
    if (activeLegacies.has('ronaldo')) {
        // 2009-2018 -> "0910" to "1718"
        const startSeason = formatSeasonLabel("0910");
        const endSeason = formatSeasonLabel("1718");
        
        const xStart = x(startSeason);
        const xEnd = x(endSeason);
        
        if (xStart !== undefined && xEnd !== undefined) {
             svg.append("rect")
                .attr("x", xStart)
                .attr("y", 0)
                .attr("width", xEnd - xStart)
                .attr("height", height)
                .attr("fill", "url(#pattern-ronaldo)")
                .style("pointer-events", "none");
        }
    }

    // teamColors est maintenant global
    
    const defaultColor = "#bdc3c7";

    const line = d3.line()
        .defined(d => d.rank !== null && d.rank <= 20)
        .x(d => x(d.season))
        .y(d => y(d.rank));

    // Filtrer les données pour n'afficher que jusqu'à la saison courante
    // On sépare l'historique (jusqu'à current-1) et le nouveau segment (current-1 à current)
    const currentSeasonLabel = seasons[currentSeasonIndex];
    const prevSeasonLabel = seasons[currentSeasonIndex - 1];

    const teamsData = data.teamsData.map(d => {
        const historyValues = d.values.filter(v => seasons.indexOf(v.season) < currentSeasonIndex);
        const newValues = d.values.filter(v => {
            const idx = seasons.indexOf(v.season);
            return idx >= currentSeasonIndex - 1 && idx <= currentSeasonIndex;
        });
        // Si c'est la première saison, pas d'historique, tout est "nouveau" (ou juste affiché)
        if (currentSeasonIndex === 0) {
            return { ...d, historyValues: d.values.filter(v => seasons.indexOf(v.season) === 0), newValues: [] };
        }
        return { ...d, historyValues, newValues };
    });

    // 1. Dessiner l'historique (visible)
    const historyLines = svg.selectAll(".bump-line-history")
        .data(teamsData)
        .enter()
        .append("path")
        .attr("class", "bump-line bump-line-history team-element")
        .attr("data-team-name", d => d.name)
        .attr("d", d => line(d.historyValues))
        .style("stroke", d => teamColors[d.name] || defaultColor)
        .style("stroke-opacity", d => (selectedTeams.size === 0 || selectedTeams.has(d.name)) ? OPACITY_HIGH : OPACITY_LOW)
        .style("stroke-width", d => (selectedTeams.has(d.name)) ? 5 : 1.5)
        .style("fill", "none");

    // 2. Dessiner le nouveau segment (caché initialement)
    const newLines = svg.selectAll(".bump-line-new")
        .data(teamsData)
        .enter()
        .append("path")
        .attr("class", "bump-line bump-line-new team-element")
        .attr("data-team-name", d => d.name)
        .attr("d", d => line(d.newValues))
        .style("stroke", d => teamColors[d.name] || defaultColor)
        .style("stroke-opacity", 0) // Caché
        .style("stroke-width", d => (selectedTeams.has(d.name)) ? 5 : 1.5)
        .style("fill", "none");

    const pointsGroup = svg.selectAll(".points-group")
        .data(teamsData)
        .enter()
        .append("g")
        .attr("class", "points-group");

    // Points historiques
    pointsGroup.selectAll(".bump-circle-history")
        .data(d => d.historyValues.filter(v => v.rank !== null && v.rank <= 20))
        .enter()
        .append("circle")
        .attr("class", "bump-circle bump-circle-history team-element")
        .attr("data-team-name", d => d.team)
        .attr("cx", d => x(d.season))
        .attr("cy", d => y(d.rank))
        .attr("r", 2)
        .style("fill", d => teamColors[d.team] || defaultColor)
        .style("opacity", d => (selectedTeams.size === 0 || selectedTeams.has(d.team)) ? OPACITY_HIGH : OPACITY_LOW);

    // Nouveaux points (cachés) - Cibles pour l'animation
    pointsGroup.selectAll(".bump-circle-new")
        .data(d => d.newValues.filter(v => v.season === currentSeasonLabel && v.rank !== null && v.rank <= 20))
        .enter()
        .append("circle")
        .attr("class", "bump-circle bump-circle-new team-element target-point")
        .attr("data-team-name", d => d.team)
        .attr("id", d => `target-${d.team.replace(/\s+/g, '-')}`) // ID pour ciblage
        .attr("cx", d => x(d.season))
        .attr("cy", d => y(d.rank))
        .attr("r", 2)
        .style("fill", d => teamColors[d.team] || defaultColor)
        .style("opacity", 0); // Caché

    svg.append("g")
        .attr("transform", `translate(0,${height})`)
        .call(d3.axisBottom(x))
        .selectAll("text")
        .style("text-anchor", "end")
        .attr("dx", "-.8em")
        .attr("dy", ".15em")
        .attr("transform", "rotate(-45)");

    svg.append("g")
        .call(d3.axisLeft(y).ticks(20));

    // Add Legends (Axis Labels)
    svg.append("text")
        .attr("text-anchor", "end")
        .attr("x", width)
        .attr("y", height + 45)
        .text("Season")
        .style("fill", "#666")
        .style("font-size", "20px");

    svg.append("text")
        .attr("text-anchor", "end")
        .attr("transform", "rotate(-90)")
        .attr("y", -30)
        .attr("x", 0)
        .text("Rank")
        .style("fill", "#666")
        .style("font-size", "20px");

    const tooltip = d3.select("body").selectAll(".tooltip-bump").data([0]).join("div")
        .attr("class", "tooltip tooltip-bump")
        .style("opacity", 0)
        .style("position", "absolute")
        .style("background", "#000000CC")
        .style("color", "white")
        .style("padding", "5px")
        .style("border-radius", "4px")
        .style("pointer-events", "none")
        .style("font-size", "12px");

    // Interaction unifiée sur les lignes (on combine visuellement)
    // Note: L'interaction sur les segments cachés ne marchera pas tant qu'ils sont cachés, ce qui est voulu.
    svg.selectAll(".hover-line")
        .data(data.teamsData) // On garde toutes les données pour le hover global si besoin, ou on adapte
        .enter()
        .append("path")
        .attr("d", d => line(d.values.filter(v => seasons.indexOf(v.season) <= currentSeasonIndex))) // Zone de clic active jusqu'à présent
        .style("stroke", "transparent")
        .style("stroke-width", 15)
        .style("fill", "none")
        .style("cursor", "pointer")
        .on("click", function(event, d) {
            toggleTeamSelection(d.name);
        })
        .on("mouseover", function(event, d) {
            // On diminue tout le monde temporairement pour le focus
            d3.selectAll(".bump-line").style("stroke-opacity", OPACITY_LOW).style("stroke-width", 1);
            svg.selectAll(".bump-circle").style("opacity", OPACITY_LOW);

            // On sélectionne les lignes de cette équipe (hist + new)
            const teamLines = d3.selectAll(`.bump-line[data-team-name="${d.name}"]`);
            teamLines
                .style("stroke-opacity", function() {
                    // Si c'est la ligne "new" et qu'elle est encore cachée (opacity 0), on la laisse cachée ?
                    // Non, le hover doit montrer l'état actuel visible.
                    // Si l'animation n'est pas finie, la ligne new est opacity 0.
                    // On ne doit pas la forcer à 1 si elle est censée être cachée.
                    const currentOp = d3.select(this).style("stroke-opacity");
                    return currentOp == 0 ? 0 : OPACITY_HIGH;
                })
                .style("stroke", teamColors[d.name] || "#3498db")
                .style("stroke-width", 5)
                .raise();

            pointsGroup.filter(p => p.name === d.name)
                .selectAll("circle")
                .style("opacity", function() {
                     const currentOp = d3.select(this).style("opacity");
                     return currentOp == 0 ? 0 : OPACITY_HIGH;
                })
                .style("fill", teamColors[d.name] || "#3498db")
                .attr("r", 5);

            tooltip.transition().duration(100).style("opacity", 0.9);
            tooltip.html(`<strong>${d.name}</strong>`)
                .style("left", (event.pageX + 10) + "px")
                .style("top", (event.pageY - 28) + "px");
        })
        .on("mousemove", function(event) {
            tooltip.style("left", (event.pageX + 10) + "px")
                   .style("top", (event.pageY - 28) + "px");
        })
        .on("mouseout", function(event, d) {
            // On restaure l'état global via la fonction de mise à jour
            updateChartsOpacity();
            
            // On restaure les largeurs de ligne
            d3.selectAll(".bump-line").style("stroke-width", l => (selectedTeams.has(l.name)) ? 5 : 1.5);
            
            svg.selectAll(".bump-circle")
                .attr("r", 3);

            tooltip.transition().duration(500).style("opacity", 0);
        });
}

function populateTeamList(allData) {
    const teams = new Set();
    allData.forEach(season => {
        season.data.forEach(match => {
            if (match.HomeTeam) teams.add(match.HomeTeam);
            if (match.AwayTeam) teams.add(match.AwayTeam);
        });
    });

    const sortedTeams = Array.from(teams).sort();
    const listContainer = document.getElementById('team-list');
    if (!listContainer) return;
    
    listContainer.innerHTML = '';

    // Bouton "Select All Teams"
    const selectAllBtn = document.createElement('div');
    selectAllBtn.textContent = 'Select All Teams';
    selectAllBtn.className = 'team-list-item';
    selectAllBtn.style.columnSpan = 'all';
    selectAllBtn.style.textAlign = 'center';
    selectAllBtn.style.fontWeight = 'bold';
    selectAllBtn.style.padding = '5px';
    selectAllBtn.style.marginBottom = '10px';
    selectAllBtn.style.cursor = 'pointer';
    selectAllBtn.style.backgroundColor = '#eee';
    selectAllBtn.style.border = '1px solid #ccc';
    selectAllBtn.style.borderRadius = '4px';

    selectAllBtn.addEventListener('click', () => {
        const allSelected = sortedTeams.every(t => selectedTeams.has(t));
        
        if (allSelected) {
            selectedTeams.clear();
            // Mise à jour visuelle de la liste
            Array.from(listContainer.children).forEach(child => {
                if (child !== selectAllBtn && child.classList.contains('team-list-item')) {
                    child.classList.remove('selected');
                    child.style.backgroundColor = 'transparent';
                    child.style.fontWeight = 'normal';
                }
            });
        } else {
            sortedTeams.forEach(t => selectedTeams.add(t));
            // Mise à jour visuelle de la liste
            Array.from(listContainer.children).forEach(child => {
                if (child !== selectAllBtn && child.classList.contains('team-list-item')) {
                    child.classList.add('selected');
                    child.style.backgroundColor = '#e0e0e0';
                    child.style.fontWeight = 'bold';
                }
            });
        }
        updateChartsOpacity();
    });
    
    listContainer.appendChild(selectAllBtn);

    sortedTeams.forEach(team => {
        const item = document.createElement('div');
        item.textContent = team;
        item.style.cursor = 'pointer';
        item.style.padding = '2px 5px';
        item.style.marginBottom = '2px';
        item.style.borderRadius = '3px';
        item.className = 'team-list-item';
        
        // Indicateur de couleur
        const colorBox = document.createElement('span');
        colorBox.style.display = 'inline-block';
        colorBox.style.width = '10px';
        colorBox.style.height = '10px';
        colorBox.style.backgroundColor = teamColors[team] || '#ccc';
        colorBox.style.marginRight = '5px';
        colorBox.style.borderRadius = '50%';
        item.prepend(colorBox);

        item.addEventListener('click', () => {
            toggleTeamSelection(team);
        });
        
        listContainer.appendChild(item);
    });
}

// Fonction principale
async function main() {
    try {
        const allData = await loadAllData();
        
        assignTeamColors(allData);
        populateTeamList(allData);

        const globalSlider = document.getElementById('global-season-slider');
        const globalLabel = document.getElementById('global-season-label');

        // Configurer le slider
        globalSlider.max = allData.length - 1;
        globalSlider.value = allData.length - 1; // Commencer par la dernière saison

        // Initialisation des données de classement une seule fois
        const rankingsData = processRankingsData(allData);

        function updateAllCharts() {
            const selectedIndex = parseInt(globalSlider.value);
            const seasonData = allData[selectedIndex];
            
            // Mettre à jour le label
            globalLabel.textContent = formatSeasonLabel(seasonData.season);

            // Mettre à jour le graphique d'efficacité
            const efficiencyData = processEfficiencyData(seasonData);
            createEfficiencyChart(efficiencyData);

            // Mettre à jour le graphique des cartons
            const cardsData = processCardsFoulsData(seasonData);
            createCardsFoulsChart(cardsData);

            // Mettre à jour le Bump Chart avec l'index de la saison courante
            createBumpChart(rankingsData, selectedIndex);

            // Mettre à jour le graphique d'évolution
            const evolutionData = processSeasonEvolution(seasonData);
            createSeasonEvolutionChart(evolutionData);

            // Mettre à jour le graphique circulaire
            createCircularChartV2(seasonData);
        }

        // Listeners pour Messi et Ronaldo
        const messiOval = document.getElementById('messi-oval');
        const ronaldoOval = document.getElementById('ronaldo-oval');

        if (messiOval) {
            messiOval.addEventListener('click', () => {
                if (activeLegacies.has('messi')) {
                    activeLegacies.delete('messi');
                    messiOval.style.transform = "scale(1)";
                    messiOval.style.boxShadow = "0 4px 6px rgba(0,0,0,0.1)";
                    messiOval.style.border = "3px solid #DB0030";
                } else {
                    activeLegacies.add('messi');
                    // Set Messi style
                    messiOval.style.transform = "scale(1.1)";
                    messiOval.style.boxShadow = "0 0 15px " + (teamColors["Barcelona"] || "#DB0030");
                    messiOval.style.border = "3px solid " + (teamColors["Barcelona"] || "#DB0030");
                }
                updateAllCharts();
            });
        }

        if (ronaldoOval) {
            ronaldoOval.addEventListener('click', () => {
                if (activeLegacies.has('ronaldo')) {
                    activeLegacies.delete('ronaldo');
                    ronaldoOval.style.transform = "scale(1)";
                    ronaldoOval.style.boxShadow = "0 4px 6px rgba(0,0,0,0.1)";
                    ronaldoOval.style.border = "3px solid #f7ef7aff";
                } else {
                    activeLegacies.add('ronaldo');
                    // Set Ronaldo style
                    ronaldoOval.style.transform = "scale(1.1)";
                    ronaldoOval.style.boxShadow = "0 0 15px " + ("#f7ef7aff");
                    ronaldoOval.style.border = "3px solid " + ("#f7ef7aff");
                }
                updateAllCharts();
            });
        }

        globalSlider.addEventListener('input', updateAllCharts);
        
        // Initialisation
        updateAllCharts();

    } catch (error) {
        console.error("Erreur lors du chargement des données:", error);

    }
}

main();

// --- Graphique 4 : Cartons vs Fautes ---

function processCardsFoulsData(seasonData) {
    const teams = {};

    seasonData.data.forEach(match => {
        const home = match.HomeTeam;
        const away = match.AwayTeam;

        if (!teams[home]) teams[home] = { name: home, fouls: 0, cards: 0, goalsConceded: 0 };
        if (!teams[away]) teams[away] = { name: away, fouls: 0, cards: 0, goalsConceded: 0 };

        // Fautes
        teams[home].fouls += parseInt(match.HF || 0);
        teams[away].fouls += parseInt(match.AF || 0);

        // Cartons (Jaunes + Rouges)
        teams[home].cards += parseInt(match.HY || 0) + parseInt(match.HR || 0);
        teams[away].cards += parseInt(match.AY || 0) + parseInt(match.AR || 0);

        // Buts encaissés
        teams[home].goalsConceded += parseInt(match.FTAG || 0);
        teams[away].goalsConceded += parseInt(match.FTHG || 0);
    });

    return Object.values(teams);
}

function createCardsFoulsChart(data) {
    const margin = {top: 40, right: 40, bottom: 50, left: 60};
    const width = 800 - margin.left - margin.right;
    const height = 500 - margin.top - margin.bottom;

    let svg = d3.select("#cards-chart").select("svg");
    let g;

    if (svg.empty()) {
        svg = d3.select("#cards-chart")
            .append("svg")
            .attr("viewBox", `0 0 ${width + margin.left + margin.right} ${height + margin.top + margin.bottom}`)
            .attr("preserveAspectRatio", "xMidYMid meet")
            .style("width", "100%")
            .style("height", "100%");
        
        g = svg.append("g")
            .attr("transform", `translate(${margin.left},${margin.top})`);

        g.append("g").attr("class", "x-axis").attr("transform", `translate(0,${height})`);
        g.append("g").attr("class", "y-axis");
        
        g.append("line").attr("class", "median-x-line").attr("stroke", "#999").attr("stroke-dasharray", "4").style("opacity", 0.5);
        g.append("line").attr("class", "median-y-line").attr("stroke", "#999").attr("stroke-dasharray", "4").style("opacity", 0.5);

        g.append("text")
            .attr("text-anchor", "end")
            .attr("x", width)
            .attr("y", height + 40)
            .text("Total Cards (Yellow + Red)")
            .style("fill", "#666")
            .style("font-size", "20px");

        g.append("text")
            .attr("text-anchor", "end")
            .attr("transform", "rotate(-90)")
            .attr("y", -40)
            .attr("x", 0)
            .text("Number of Fouls")
            .style("fill", "#666")
            .style("font-size", "20px");
    } else {
        g = svg.select("g");
    }

    // Echelles (Inversées : X=Cartons, Y=Fautes)
    const x = d3.scaleLinear()
        .domain([d3.min(data, d => d.cards) * 0.9, d3.max(data, d => d.cards) * 1.1])
        .range([0, width]);

    const y = d3.scaleLinear()
        .domain([d3.min(data, d => d.fouls) * 0.9, d3.max(data, d => d.fouls) * 1.1])
        .range([height, 0]);

    // Taille inversement proportionnelle aux buts encaissés
    const minGC = d3.min(data, d => d.goalsConceded);
    const maxGC = d3.max(data, d => d.goalsConceded);
    
    const z = d3.scaleLinear()
        .domain([maxGC, minGC]) // Max GC -> Petite taille, Min GC -> Grande taille
        .range([5, 20]);

    // Médianes
    const medianFouls = d3.median(data, d => d.fouls);
    const medianCards = d3.median(data, d => d.cards);

    const t = d3.transition().duration(750);

    g.select(".x-axis").transition(t).call(d3.axisBottom(x));
    g.select(".y-axis").transition(t).call(d3.axisLeft(y));

    g.select(".median-x-line").transition(t)
        .attr("x1", x(medianCards)).attr("x2", x(medianCards))
        .attr("y1", 0).attr("y2", height);

    g.select(".median-y-line").transition(t)
        .attr("x1", 0).attr("x2", width)
        .attr("y1", y(medianFouls)).attr("y2", y(medianFouls));

    const tooltip = d3.select("body").selectAll(".tooltip-cards").data([0]).join("div")
        .attr("class", "tooltip tooltip-cards")
        .style("opacity", 0);

    // Points
    g.selectAll("circle")
        .data(data, d => d.name)
        .join(
            enter => enter.append("circle")
                .attr("class", "team-element")
                .attr("data-team-name", d => d.name)
                .attr("cx", d => x(d.cards))
                .attr("cy", d => y(d.fouls))
                .attr("r", 0)
                .style("fill", d => teamColors[d.name] || "#e74c3c")
                .style("opacity", d => (selectedTeams.size === 0 || selectedTeams.has(d.name)) ? OPACITY_HIGH : OPACITY_LOW)
                .style("stroke", "white")
                .call(enter => enter.transition(t)
                    .attr("r", d => z(d.goalsConceded))),
            update => update.transition(t)
                .attr("cx", d => x(d.cards))
                .attr("cy", d => y(d.fouls))
                .attr("r", d => z(d.goalsConceded))
                .style("fill", d => teamColors[d.name] || "#e74c3c")
                .style("opacity", d => (selectedTeams.size === 0 || selectedTeams.has(d.name)) ? OPACITY_HIGH : OPACITY_LOW),
            exit => exit.transition(t).attr("r", 0).remove()
        )
        .on("mouseover", function(event, d) {
            d3.select(this).style("stroke", "#333");
            tooltip.transition().duration(200).style("opacity", 0.9);
            tooltip.html(`
                <strong>${d.name}</strong><br/>
                Fouls: ${d.fouls}<br/>
                Cards: ${d.cards}<br/>
                Goals Conceded: ${d.goalsConceded}
            `)
            .style("left", (event.pageX + 10) + "px")
            .style("top", (event.pageY - 28) + "px");
        })
        .on("mouseout", function() {
            d3.select(this).style("stroke", "white");
            tooltip.transition().duration(500).style("opacity", 0);
        })
        .on("click", function(event, d) {
            toggleTeamSelection(d.name);
        });

    // Labels pour les équipes extrêmes
    g.selectAll(".team-label")
        .data(data, d => d.name)
        .join(
            enter => enter.append("text")
                .attr("class", "team-label")
                .attr("x", d => x(d.cards))
                .attr("y", d => y(d.fouls) - z(d.goalsConceded) - 5)
                .text(d => d.name)
                .style("font-size", "10px")
                .style("fill", "#333")
                .style("text-anchor", "middle")
                .style("pointer-events", "none")
                .style("opacity", 0)
                .call(enter => enter.transition(t).style("opacity", 1)),
            update => update.transition(t)
                .attr("x", d => x(d.cards))
                .attr("y", d => y(d.fouls) - z(d.goalsConceded) - 5)
                .style("opacity", d => (Math.abs(d.fouls - medianFouls) > 50 || Math.abs(d.cards - medianCards) > 15 || d.goalsConceded === minGC) ? 1 : 0),
            exit => exit.transition(t).style("opacity", 0).remove()
        );
}

// --- Graphique 1 : Évolution du Classement (Saison) ---

function processSeasonEvolution(seasonData) {
    const parseDate = (dateStr) => {
        if (!dateStr) return new Date(0);
        const parts = dateStr.split('/');
        if (parts.length === 3) {
             // Format DD/MM/YY
             let year = parseInt(parts[2]);
             // Pivot pour les années 2000 vs 1900 si nécessaire, mais ici c'est 2000+
             year += (year < 100) ? 2000 : 0;
             return new Date(year, parseInt(parts[1]) - 1, parseInt(parts[0]));
        }
        return new Date(0);
    };

    // Trier les matchs par date
    const matches = [...seasonData.data].sort((a, b) => parseDate(a.Date) - parseDate(b.Date));

    const teams = {};
    
    // Initialiser les équipes
    matches.forEach(m => {
        if (m.HomeTeam && !teams[m.HomeTeam]) teams[m.HomeTeam] = { name: m.HomeTeam, points: 0, gd: 0, goals: 0, history: [] };
        if (m.AwayTeam && !teams[m.AwayTeam]) teams[m.AwayTeam] = { name: m.AwayTeam, points: 0, gd: 0, goals: 0, history: [] };
    });

    const teamMatchCounts = {};
    Object.keys(teams).forEach(t => teamMatchCounts[t] = 0);

    matches.forEach(match => {
        const home = match.HomeTeam;
        const away = match.AwayTeam;
        
        if (!home || !away) return;

        const hg = parseInt(match.FTHG || 0);
        const ag = parseInt(match.FTAG || 0);
        
        teams[home].goals += hg;
        teams[home].gd += (hg - ag);
        teams[away].goals += ag;
        teams[away].gd += (ag - hg);

        if (match.FTR === 'H') teams[home].points += 3;
        else if (match.FTR === 'D') {
            teams[home].points += 1;
            teams[away].points += 1;
        } else if (match.FTR === 'A') teams[away].points += 3;

        teamMatchCounts[home]++;
        teamMatchCounts[away]++;

        teams[home].history.push({
            matchday: teamMatchCounts[home],
            points: teams[home].points,
            gd: teams[home].gd,
            goals: teams[home].goals
        });
        teams[away].history.push({
            matchday: teamMatchCounts[away],
            points: teams[away].points,
            gd: teams[away].gd,
            goals: teams[away].goals
        });
    });

    const maxMatchday = Math.max(...Object.values(teamMatchCounts));
    const rankingHistory = [];

    for (let m = 1; m <= maxMatchday; m++) {
        const currentStandings = [];
        Object.values(teams).forEach(team => {
            const state = team.history.find(h => h.matchday === m);
            if (state) {
                currentStandings.push({ name: team.name, ...state });
            } else {
                // Si pas de match ce jour-là, prendre le dernier état connu
                const lastState = team.history.filter(h => h.matchday < m).pop();
                if (lastState) {
                     currentStandings.push({ name: team.name, ...lastState });
                }
            }
        });

        currentStandings.sort((a, b) => {
            if (b.points !== a.points) return b.points - a.points;
            if (b.gd !== a.gd) return b.gd - a.gd;
            return b.goals - a.goals;
        });

        currentStandings.forEach((team, index) => {
            rankingHistory.push({
                team: team.name,
                matchday: m,
                rank: index + 1,
                points: team.points
            });
        });
    }

    return Object.keys(teams).map(teamName => {
        return {
            name: teamName,
            values: rankingHistory.filter(r => r.team === teamName).sort((a, b) => a.matchday - b.matchday)
        };
    });
}

function createSeasonEvolutionChart(data) {
    // Correction : S'assurer que le conteneur occupe tout l'espace (comme pour le bump chart)
    d3.select("#evolution-chart")
        .style("width", "100%")
        .style("height", "100%")
        .style("display", "flex")
        .style("justify-content", "center")
        .style("align-items", "center");

    d3.select("#evolution-chart").selectAll("*").remove();

    const margin = {top: 30, right: 30, bottom: 40, left: 50};
    const width = 900 - margin.left - margin.right;
    const height = 600 - margin.top - margin.bottom;

    const svg = d3.select("#evolution-chart")
        .append("svg")
        .attr("viewBox", `0 0 ${width + margin.left + margin.right} ${height + margin.top + margin.bottom}`)
        .attr("preserveAspectRatio", "xMidYMid meet")
        .style("width", "100%")
        .style("height", "100%")
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    // Calculer le max de points pour l'échelle Y
    const maxPoints = d3.max(data, d => d3.max(d.values, v => v.points)) || 100;

    const x = d3.scaleLinear()
        .domain([1, 38])
        .range([0, width]);

    const y = d3.scaleLinear()
        .domain([0, maxPoints])
        .range([height, 0]);

    svg.append("g")
        .attr("transform", `translate(0,${height})`)
        .call(d3.axisBottom(x).ticks(10).tickFormat(d => `J${d}`));

    svg.append("g")
        .call(d3.axisLeft(y).ticks(10));

    // Add Legends (Axis Labels)
    svg.append("text")
        .attr("text-anchor", "end")
        .attr("x", width)
        .attr("y", height + 35)
        .text("Matchday")
        .style("fill", "#666")
        .style("font-size", "20px");
    

    svg.append("text")
        .attr("text-anchor", "end")
        .attr("transform", "rotate(-90)")
        .attr("y", -35)
        .attr("x", 0)
        .text("Points")
        .style("fill", "#666")
        .style("font-size", "20px");

    const line = d3.line()
        .x(d => x(d.matchday))
        .y(d => y(d.points));

    const lines = svg.selectAll(".evolution-line")
        .data(data)
        .enter()
        .append("path")
        .attr("class", "evolution-line team-element")
        .attr("data-team-name", d => d.name)
        .attr("d", d => line(d.values))
        .attr("fill", "none")
        .attr("stroke", d => teamColors[d.name] || "#ccc")
        .attr("stroke-width", d => selectedTeams.has(d.name) ? 4 : 1.5)
        .attr("stroke-linecap", "round")
        .style("stroke-opacity", d => (selectedTeams.size === 0 || selectedTeams.has(d.name)) ? OPACITY_HIGH : OPACITY_LOW)
        .style("cursor", "pointer");

    // Animation progressive
    let transitionsCompleted = 0;
    const totalLines = lines.size();

    lines.each(function(d) {
        const length = this.getTotalLength();
        d3.select(this)
            .attr("stroke-dasharray", length + " " + length)
            .attr("stroke-dashoffset", length)
            .transition()
            .duration(2000)
            .ease(d3.easeLinear)
            .attr("stroke-dashoffset", 0)
            .on("end", () => {
                transitionsCompleted++;
                if (transitionsCompleted === totalLines) {
                    // Animation terminée, lancer les points volants
                    launchFlyingDots(data, x, y, svg);
                }
            });
    });

    // Tooltip
    const tooltip = d3.select("body").selectAll(".tooltip-evolution").data([0]).join("div")
        .attr("class", "tooltip tooltip-evolution")
        .style("opacity", 0)
        .style("position", "absolute")
        .style("background", "#000000CC")
        .style("color", "white")
        .style("padding", "5px")
        .style("border-radius", "4px")
        .style("pointer-events", "none")
        .style("font-size", "12px");

    lines.on("mouseover", function(event, d) {
        d3.select(this).attr("stroke-width", 4);
        tooltip.transition().duration(200).style("opacity", 0.9);
        tooltip.html(`<strong>${d.name}</strong>`)
            .style("left", (event.pageX + 10) + "px")
            .style("top", (event.pageY - 28) + "px");
    })
    .on("mouseout", function(event, d) {
        d3.select(this).attr("stroke-width", selectedTeams.has(d.name) ? 4 : 1.5);
        tooltip.transition().duration(500).style("opacity", 0);
    })
    .on("click", function(event, d) {
        toggleTeamSelection(d.name);
    });
}

function launchFlyingDots(data, x, y, sourceSvg) {
    // Créer un conteneur d'overlay s'il n'existe pas
    let overlay = d3.select("#animation-overlay");
    if (overlay.empty()) {
        overlay = d3.select("body").append("div")
            .attr("id", "animation-overlay")
            .style("position", "fixed")
            .style("top", 0)
            .style("left", 0)
            .style("width", "100%")
            .style("height", "100%")
            .style("pointer-events", "none")
            .style("z-index", 9999);
    }
    overlay.selectAll("*").remove();

    // Récupérer la position du SVG source par rapport à la fenêtre
    const sourceNode = sourceSvg.node();
    const ownerSVG = sourceNode.closest('svg');
    
    data.forEach(teamData => {
        // Si des équipes sont sélectionnées, n'animer que celles-ci
        if (selectedTeams.size > 0 && !selectedTeams.has(teamData.name)) return;

        const lastPoint = teamData.values[teamData.values.length - 1];
        if (!lastPoint) return;

        // Coordonnées de départ (Zone 1)
        let screenPt;
        try {
            let pt;
            if (window.DOMPoint) {
                pt = new DOMPoint(x(lastPoint.matchday), y(lastPoint.points));
            } else if (ownerSVG && typeof ownerSVG.createSVGPoint === 'function') {
                pt = ownerSVG.createSVGPoint();
                pt.x = x(lastPoint.matchday);
                pt.y = y(lastPoint.points);
            } else {
                return;
            }
            screenPt = pt.matrixTransform(sourceNode.getScreenCTM());
        } catch (e) {
            console.warn("Erreur calcul position point volant:", e);
            return;
        }

        // Coordonnées d'arrivée (Zone 3 - Bump Chart)
        // On cherche le cercle cible caché
        const targetId = `target-${teamData.name.replace(/\s+/g, '-')}`;
        const targetCircle = document.getElementById(targetId);
        
        if (targetCircle) {
            const targetRect = targetCircle.getBoundingClientRect();
            const targetX = targetRect.left + targetRect.width / 2;
            const targetY = targetRect.top + targetRect.height / 2;

            // Créer le point volant
            const flyDot = overlay.append("div")
                .style("position", "absolute")
                .style("width", "6px")
                .style("height", "6px")
                .style("background-color", teamColors[teamData.name] || "#ccc")
                .style("border-radius", "50%")
                .style("left", (screenPt.x - 3) + "px")
                .style("top", (screenPt.y - 3) + "px")
                .style("opacity", 1);

            // Animer
            flyDot.transition()
                .duration(1500)
                .ease(d3.easeCubicInOut)
                .style("left", (targetX - 3) + "px")
                .style("top", (targetY - 3) + "px")
                .on("end", function() {
                    d3.select(this).remove();
                    
                    // Révéler le point et la ligne dans le Bump Chart
                    d3.select(targetCircle).style("opacity", (selectedTeams.size === 0 || selectedTeams.has(teamData.name)) ? OPACITY_HIGH : OPACITY_LOW);
                    
                    // Révéler le segment de ligne correspondant
                    // On cherche la ligne "new" pour cette équipe
                    d3.selectAll(`.bump-line-new[data-team-name="${teamData.name}"]`)
                        .transition().duration(500)
                        .style("stroke-opacity", (selectedTeams.size === 0 || selectedTeams.has(teamData.name)) ? OPACITY_HIGH : OPACITY_LOW);
                });
        }
    });
}

// --- Graphique 5 : Circular Chart V2 (Zone 2) ---

function createCircularChartV2(seasonData) {
    // Helper pour les dates
    const parseDate = (dateStr) => {
        if (!dateStr) return new Date(0);
        const parts = dateStr.split('/');
        if (parts.length === 3) {
             let year = parseInt(parts[2]);
             year += (year < 100) ? 2000 : 0;
             return new Date(year, parseInt(parts[1]) - 1, parseInt(parts[0]));
        }
        return new Date(0);
    };

    // Trier les matchs par date pour l'animation
    const matches = [...seasonData.data].sort((a, b) => parseDate(a.Date) - parseDate(b.Date));

    // Extraire les équipes de la saison
    const teamsSet = new Set();
    matches.forEach(match => {
        if (match.HomeTeam) teamsSet.add(match.HomeTeam);
        if (match.AwayTeam) teamsSet.add(match.AwayTeam);
    });
    const teams = Array.from(teamsSet).sort();

    const margin = {top: 20, right: 20, bottom: 20, left: 20};
    const width = 400; 
    const height = 400;
    const radius = Math.min(width, height) / 2 - Math.max(margin.top, margin.right);

    let svg = d3.select("#circular-chart").select("svg");
    let g;

    if (svg.empty()) {
        svg = d3.select("#circular-chart")
            .append("svg")
            .attr("viewBox", `0 0 ${width} ${height}`)
            .attr("preserveAspectRatio", "xMidYMid meet")
            .style("width", "100%")
            .style("height", "100%");
        
        // Groupe principal centré
        g = svg.append("g")
            .attr("transform", `translate(${width / 2},${height / 2})`);
            
        // Groupe pour les liens (derrière)
        g.append("g").attr("class", "links-group");
        // Groupe pour les arcs (devant)
        g.append("g").attr("class", "arcs-group");
        
        // Defs pour les gradients
        const defs = svg.append("defs");

        // --- Légende ---
        const legend = svg.append("g")
            .attr("class", "legend")
            .attr("transform", `translate(${width + 10}, ${height / 2})`);

        // Gradient pour la légende (Vertical)
        const legendGradient = defs.append("linearGradient")
            .attr("id", "legend-gradient")
            .attr("x1", "0%")
            .attr("y1", "0%")
            .attr("x2", "0%")
            .attr("y2", "100%");
        
        legendGradient.append("stop").attr("offset", "0%").attr("stop-color", "#00ff6aff"); // Vert (Victoire)
        legendGradient.append("stop").attr("offset", "100%").attr("stop-color", "#ff1900ff"); // Rouge (Défaite)

        // Barre de gradient (Victoire -> Défaite)
        legend.append("rect")
            .attr("x", 0)
            .attr("y", -60)
            .attr("width", 8)
            .attr("height", 120)
            .style("fill", "url(#legend-gradient)")
            .style("rx", 2);

        // Barre grise (Nul)
        legend.append("rect")
            .attr("x", 0)
            .attr("y", 70)
            .attr("width", 8)
            .attr("height", 20)
            .style("fill", "#bdc3c7")
            .style("rx", 2);

        // Textes
        legend.append("text")
            .attr("x", -5)
            .attr("y", -60)
            .text("Win")
            .style("font-size", "10px")
            .style("fill", "#666")
            .style("text-anchor", "end")
            .style("alignment-baseline", "middle");

        legend.append("text")
            .attr("x", -5)
            .attr("y", 60)
            .text("Loss")
            .style("font-size", "10px")
            .style("fill", "#666")
            .style("text-anchor", "end")
            .style("alignment-baseline", "middle");

        legend.append("text")
            .attr("x", -5)
            .attr("y", 80)
            .text("Draw")
            .style("font-size", "10px")
            .style("fill", "#666")
            .style("text-anchor", "end")
            .style("alignment-baseline", "middle");

    } else {
        g = svg.select("g");
    }

    const linkGroup = g.select(".links-group");
    const arcGroup = g.select(".arcs-group");
    const defs = svg.select("defs");

    // Nettoyage (ne supprimer que les gradients de match)
    linkGroup.selectAll("*").remove();
    defs.selectAll(".match-gradient").remove();

    // Configuration des arcs
    const innerRadius = radius * 0.85;
    const outerRadius = radius * 0.95;

    const pie = d3.pie()
        .value(1)
        .sort(null);

    const pieData = pie(teams);
    
    // Calcul des positions pour les liens
    const teamAngles = {};
    pieData.forEach(d => {
        const angle = (d.startAngle + d.endAngle) / 2;
        teamAngles[d.data] = {
            angle: angle,
            x: innerRadius * Math.sin(angle),
            y: -innerRadius * Math.cos(angle)
        };
    });

    // --- Dessin des Arcs ---
    const arc = d3.arc()
        .innerRadius(innerRadius)
        .outerRadius(outerRadius)
        .padAngle(0.02)
        .cornerRadius(4);

    const arcs = arcGroup.selectAll(".arc")
        .data(pieData, d => d.data);

    arcs.join(
        enter => {
            const path = enter.append("path")
                .attr("class", "arc team-element")
                .attr("data-team-name", d => d.data)
                .attr("fill", d => teamColors[d.data] || "#ccc")
                .attr("d", arc)
                .style("opacity", d => (selectedTeams.size === 0 || selectedTeams.has(d.data)) ? OPACITY_HIGH : OPACITY_LOW)
                .each(function(d) { this._current = d; });
           return path;
        },
        update => {
            return update
                .attr("fill", d => teamColors[d.data] || "#ccc")
                .style("opacity", d => (selectedTeams.size === 0 || selectedTeams.has(d.data)) ? OPACITY_HIGH : OPACITY_LOW)
                .transition().duration(750)
                .attrTween("d", function(d) {
                    const i = d3.interpolate(this._current, d);
                    this._current = i(0);
                    return t => arc(i(t));
                });
        },
        exit => exit.remove()
    );

    // --- Préparation des Liens (Matchs) ---
    const linksData = matches.map((match, i) => {
        const source = teamAngles[match.HomeTeam];
        const target = teamAngles[match.AwayTeam];
        if (!source || !target) return null;

        const result = match.FTR; // 'H', 'A', 'D'
        const id = `grad-${i}`;
        
        return {
            id: id,
            source: source,
            target: target,
            result: result,
            index: i,
            home: match.HomeTeam,
            away: match.AwayTeam
        };
    }).filter(d => d !== null);

    // Création des gradients
    linksData.forEach(d => {
        if (d.result === 'D') return;

        const gradient = defs.append("linearGradient")
            .attr("id", d.id)
            .attr("class", "match-gradient") // Ajout de la classe pour le nettoyage ciblé
            .attr("gradientUnits", "userSpaceOnUse")
            .attr("x1", d.source.x)
            .attr("y1", d.source.y)
            .attr("x2", d.target.x)
            .attr("y2", d.target.y);

        if (d.result === 'H') {
            // Home Win: Green -> Red
            gradient.append("stop").attr("offset", "0%").attr("stop-color", "#00ff6aff");
            gradient.append("stop").attr("offset", "100%").attr("stop-color", "#ff1900ff");
        } else {
            // Away Win: Red -> Green
            gradient.append("stop").attr("offset", "0%").attr("stop-color", "#ff1900ff");
            gradient.append("stop").attr("offset", "100%").attr("stop-color", "#00ff6aff");
        }
    });

    // Dessin des liens
    linkGroup.selectAll(".match-link")
        .data(linksData)
        .enter()
        .append("path")
        .attr("class", "match-link")
        .attr("d", d => {
            const path = d3.path();
            path.moveTo(d.source.x, d.source.y);
            path.quadraticCurveTo(0, 0, d.target.x, d.target.y);
            return path.toString();
        })
        .attr("fill", "none")
        .attr("stroke-width", 1.5)
        .attr("stroke", d => {
            if (d.result === 'D') return "#bdc3c7"; // Gris pour nul
            return `url(#${d.id})`;
        })
        .style("opacity", 0)
        .transition()
        .delay(d => (d.index / linksData.length) * 3000) // Synchro avec l'autre graphe
        .duration(100)
        .style("opacity", d => {
            if (selectedTeams.size === 0) return 0.4;
            if (selectedTeams.has(d.home) || selectedTeams.has(d.away)) return 0.8;
            return 0.05;
        });

    // Tooltip
    const tooltip = d3.select("body").selectAll(".tooltip-circular").data([0]).join("div")
        .attr("class", "tooltip tooltip-circular")
        .style("opacity", 0)
        .style("position", "absolute")
        .style("background", "#000000CC")
        .style("color", "white")
        .style("padding", "5px")
        .style("border-radius", "4px")
        .style("pointer-events", "none")
        .style("font-size", "12px");

    // Interactions Arcs
    g.selectAll(".arc")
        .on("mouseover", function(event, d) {
            d3.select(this).style("stroke", "#333").style("stroke-width", 2);
            tooltip.transition().duration(200).style("opacity", 0.9);
            tooltip.html(`<strong>${d.data}</strong>`)
                .style("left", (event.pageX + 10) + "px")
                .style("top", (event.pageY - 28) + "px");
            
            // Mettre en évidence les liens de l'équipe
            linkGroup.selectAll(".match-link")
                .style("opacity", l => (l.home === d.data || l.away === d.data) ? 0.8 : 0.05);
        })
        .on("mousemove", function(event) {
            tooltip.style("left", (event.pageX + 10) + "px")
                   .style("top", (event.pageY - 28) + "px");
        })
        .on("mouseout", function(event, d) {
            d3.select(this).style("stroke", "none");
            tooltip.transition().duration(500).style("opacity", 0);
            
            // Restaurer l'opacité des liens via la fonction globale
            updateChartsOpacity();
        })
        .on("click", function(event, d) {
            toggleTeamSelection(d.data);
        });
}