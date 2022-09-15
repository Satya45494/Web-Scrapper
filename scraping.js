//node scraping.js --excel=ipl2020.csv --dir=ipl2020 --source=https://www.espncricinfo.com/series/ipl-2020-21-1210595/match-results
//require all used repositries and fs etc.
let minimist   = require("minimist");
let axios      = require("axios");
let jsdom      = require("jsdom");
let excel4node = require("excel4node");
let pdf        = require("pdf-lib");
let fs         = require("fs");
let path       = require("path");
const { NONAME } = require("dns");

let input      = minimist(process.argv);    //taking input

//gather data from source url
let datafromweb=axios.get(input.source);
datafromweb.then(function(response){
    let html = response.data;

    let dom=new jsdom.JSDOM(html);
    let document=dom.window.document;
    let matchdetails=document.querySelectorAll("div.match-score-block");
    let matches=[];
   
    for(let i=0;i<matchdetails.length;i++){
        
        let match={
            team1:"",
            team2:"",
            team1score:"",
            team2score:"",
            result:""
        };

        let tname=matchdetails[i].querySelectorAll("div.name-detail > p.name");
        match.team1 = tname[0].textContent;
        match.team2 = tname[1].textContent;

        let tscore=matchdetails[i].querySelectorAll("div.score-detail > span.score");
        //now you have many choise may be match postponed so no score or rain caused only first batting handle these case using if else
        if(tscore.length == 2){
            match.team1score = tscore[0].textContent;
            match.team2score = tscore[1].textContent;
        }else if(tscore.length ==1){
            match.team1score = tscore[0].textContent;
            match.team2score = "";
        }else{
            match.team1score = "";
            match.team2score = "";
        }
        
        
        let tresult=matchdetails[i].querySelector("div.status-text > span");
        match.result = tresult.textContent;

        matches.push(match);

    }
    
    //now stringify to create a json file to see what we have extracted just to see ignore
    let matchstring=JSON.stringify(matches);
    fs.writeFileSync("matchstring.json",matchstring,"utf-8");

    //now we have to make array to add match of that team in that array only 
    let team=[];
    for(let i=0;i<matches.length;i++){
        addteamtoarrayifnotthere(team,matches[i].team1);
        addteamtoarrayifnotthere(team,matches[i].team2);
    }
    for(let i=0;i<matches.length;i++){
        addmatchestoteam(team,matches[i].team1,matches[i].team2,matches[i].team1score,matches[i].team2score,matches[i].result);
        addmatchestoteam(team,matches[i].team2,matches[i].team1,matches[i].team2score,matches[i].team1score,matches[i].result);

    }
    //creating file to see is team has created formated data
    let teamsKaJSON = JSON.stringify(team);
    fs.writeFileSync("teams.json", teamsKaJSON, "utf-8");


    createexcelfile(team);
    createfolders(team,input.dir);


})

function createfolders(team,file){
    if(fs.existsSync(file)==false){
        fs.mkdirSync(file);
    }
    for(let i=0;i<team.length;i++){
        let teamname =path.join(file,team[i].name);
        if(fs.existsSync(teamname)==false){
            fs.mkdirSync(teamname);
        }

        for(let j=0;j<team[i].matches.length;j++){
            let opponentname=team[i].matches[j];
            let selfname=team[i].name;
            creatematchpdf(teamname,opponentname,selfname);
        }
    }
}

function creatematchpdf(teamname,vs,hometeam){

    let makepdf=path.join(teamname,vs.vs);

    let templateFileBytes=fs.readFileSync("TEMPLATE.pdf");
    let pdfload=pdf.PDFDocument.load(templateFileBytes);

    pdfload.then(function(originalpdf){
        let page=originalpdf.getPage(0);
        page.drawText(hometeam,{
            x: 43,
            y: 553,
            size: 15,
            
        })
        page.drawText(vs.selfscore,{
            x: 110,
            y: 515,
            size: 18,
            
        })
        page.drawText(vs.vs,{
            x: 315,
            y: 553,
            size: 15,
            
        })
        page.drawText(vs.oppscr,{
            x: 400,
            y: 515,
            size: 18,
            
        })
        page.drawText(vs.result,{
            x: 135,
            y: 423,
            size: 22,
            
        })
        let savefile=originalpdf.save();
        savefile.then(function (filesaved){
            
            fs.writeFileSync(makepdf + ".pdf",filesaved);
            
        })
    })

}


function createexcelfile(team){
    let wb = new excel4node.Workbook();
    let style = wb.createStyle({
        font:{
            color: '#1000f7',
            size: 12,
        },
        fill:{
            type: 'pattern',
            fgColor: '#00f7df',
        },
    });

    for(let i=0;i<team.length;i++){
        let sheetname=wb.addWorksheet(team[i].name);

        sheetname.cell(1,1).string("vs").style(style);
        sheetname.cell(1,2).string("Self Score").style(style);
        sheetname.cell(1,3).string("Oppostion Score").style(style);
        sheetname.cell(1,4).string("Result").style(style);

        for(let j=0;j<team[i].matches.length;j++){
            sheetname.cell(2+j,1).string(team[i].matches[j].vs).style(style);
            sheetname.cell(2+j,2).string(team[i].matches[j].selfscore).style(style);
            sheetname.cell(2+j,3).string(team[i].matches[j].oppscr).style(style);
            sheetname.cell(2+j,4).string(team[i].matches[j].result).style(style);
        }

    }
    wb.write(input.excel);
}

//add scorecard in matchs object inside team array
function addmatchestoteam(team,team1,team2,team1scr,team2scr,description){
    let index=-1;
    for(let i=0;i<team.length;i++){
        if(team[i].name==team1){
            index=i;
            break;
        }
    }
    let teams=team[index];
    teams.matches.push({
        vs:team2,
        selfscore:team1scr,
        oppscr:team2scr,
        result:description
    })

}

//add name if not there
function addteamtoarrayifnotthere(team,teamname){

    let index=-1;
    for(let i=0;i<team.length;i++){
        if(team[i].name==teamname){
            index=i;
            break;
        }
    }
    if(index ==-1){
        team.push({
            name:teamname,
            matches:[]
        })
    }
}


