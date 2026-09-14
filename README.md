# La Liga Data Visualization

**Interactive Data Visualization Project · École Polytechnique · Sep-Dec 2025**

An interactive web dashboard for exploring **20 seasons of La Liga football data (2005/06–2024/25)** through coordinated visualizations built with **D3.js**.

The project combines season-by-season and long-term perspectives on team performance, match outcomes, discipline, and scoring efficiency. Interactions are linked across the dashboard, allowing users to select teams, navigate between seasons, and explore how patterns evolve over two decades of Spanish football.

> **Collaborative project developed by Titouan Salin and Côme Rochas.**  
> The project was originally published on Côme Rochas' GitHub. This repository is a portfolio version maintained by Titouan Salin, with additional documentation and the project report.

---

## Overview

The dashboard was designed to make a large historical football dataset explorable through multiple complementary views.

Rather than displaying independent charts, the interface uses **coordinated interactions**: selecting a team in one visualization highlights the same team throughout the dashboard, while a global season slider updates season-specific views.

The project combines:

- **20 seasons** of La Liga match data
- **Five coordinated interactive visualizations**
- Cross-view team selection and highlighting
- Dynamic season filtering
- Animated transitions
- Longitudinal and season-specific analyses
- A dedicated Messi / Ronaldo era exploration

---

## Visualizations

### 1. Title Race — Season Progression

An animated line chart reconstructs the championship race throughout a selected season.

Each line represents a team and tracks its **cumulative points by matchday**, making it possible to identify early leaders, late comebacks, and close title races.

Users can hover over or select teams to emphasize their trajectories while fading other teams into the background.

### 2. Who Beat Whom? — Match Outcome Network

A circular network represents all head-to-head matches during the selected season.

Teams are positioned around the circle and connected through curved links encoding match outcomes. Interactive highlighting allows users to isolate one or several teams and inspect their results against the rest of the league.

### 3. Overall Leaderboard — Historical Bump Chart

A longitudinal bump chart tracks each team's **final league ranking from 2005/06 to 2024/25**.

It reveals long-term patterns such as sustained dominance, changes in competitive performance, promotion and relegation, and the trajectories of individual clubs across two decades.

A dedicated **"Focus on a Legacy"** interaction highlights:

- Lionel Messi's La Liga era
- Cristiano Ronaldo's La Liga era

allowing their careers to be placed in the broader historical context of league performance.

### 4. Fouls & Aggressivity

An interactive scatterplot compares:

- **Cards received**
- **Fouls committed**
- **Goals conceded**, encoded through bubble size

This view helps identify differences in playing style and defensive performance, as well as teams behaving differently from the league-wide relationship between fouls and disciplinary sanctions.

### 5. Goal Efficiency

A second scatterplot explores attacking efficiency through:

- **Average shots per match**
- **Average goals per match**
- **Season points**, encoded through bubble size

Reference lines make it possible to distinguish teams with high attacking volume from teams converting their opportunities particularly efficiently.

---

## Coordinated Interactions

A central part of the project is the interaction between visualizations.

Selecting a team from the title race, network, leaderboard, scatterplots, or team-selection menu automatically highlights that team across the other views.

```text
                 Season Slider
                      │
                      ▼
              Selected Season
                      │
        ┌─────────────┼─────────────┐
        ▼             ▼             ▼
   Title Race    Match Network   Scatterplots
        │             │             │
        └─────────────┼─────────────┘
                      │
                Team Selection
                      │
                      ▼
             Overall Leaderboard
```

This coordinated-view approach allows users to move between different perspectives on the same team without losing context.

---

## Data Processing

The dashboard uses historical La Liga match data from the **2005/06 through 2024/25 seasons**.

The raw data contains match-level information including:

- Home and away teams
- Match outcomes
- Goals
- Shots
- Fouls
- Yellow and red cards

Each season is stored as a CSV file in the `data/` directory.

Data processing is performed directly in **JavaScript** when the application loads. Match-level observations are aggregated to derive metrics required by the visualizations, including:

- League standings and final rankings
- Cumulative points by matchday
- Team-level fouls and cards
- Goals conceded
- Average shots per match
- Average goals per match
- Season-level team performance

Final standings are reconstructed from match results using total points, goal difference, and goals scored as ranking criteria.

---

## Tech Stack

**JavaScript · D3.js · HTML · CSV**

The project focuses on interactive data visualization, client-side data processing, coordinated views, animation, and exploratory visual analytics.

---

## Repository Structure

```text
LaLiga-Data-Visualization/
│
├── data/                  # Historical La Liga match data by season
│
├── report/                # Written project report
│   └── [report].pdf
│
├── index.html             # Dashboard structure and interface
│
├── script.js              # Data processing, D3 visualizations,
│                          # interactions, and animations
│
├── messi.jpg              # Messi legacy-focus asset
├── ronaldo.jpg            # Ronaldo legacy-focus asset
│
└── README.md              # Project overview and documentation
```

---

## Running the Project

Because the dashboard loads CSV data dynamically, it should be served through a local web server rather than opening `index.html` directly.

For example, using Python:

```bash
python -m http.server 8000
```

Then open:

```text
http://localhost:8000
```

in a web browser.

---

## Project Report

A detailed explanation of the dataset, visualization design, interactions, and implementation choices is available in the project report:

**[Read the full project report](report/LaLiga_Visualization_Project_Report.pdf)**

---

## Authors & Attribution

This project was developed collaboratively by:

- **Titouan Salin**
- **Côme Rochas**

The original version of the project was first published in **Côme Rochas' GitHub repository**:

**[Original repository — ComeRochas/LaLigaVisualisation](https://github.com/ComeRochas/LaLigaVisualisation)**

This repository is maintained by Titouan Salin as a portfolio version of the collaborative project, with additional documentation and project materials.
