# Balancing a City Budget

**Students:** https://eecastro.github.io/city-budget/  
**Teacher view:** https://eecastro.github.io/city-budget/?teacher  
**Developer:** Eric E Castro

An in-class activity that bridges to environmental justice (Intro to Ethnic Studies, Unit 3). Each group is a Board of Supervisors. It names its city and describes it (urban, suburban or rural; industry-focused, bedroom community or service center; who lives there; and where it is). Those choices raise or lower the comptroller's starting budget, and the group sees exactly how before it starts, and the city's departments have requested more money than it can afford. Groups decide how much to grant each of the 56 requests. The teacher view shows every group's progress live and charts how groups are prioritizing departments and projects. The discussion prompts aren't on the site; they're in the Canvas exit ticket.

Converted from the "Balancing A City Budget" Google Sheet and the "Balancing a City Budget" Google Doc. Department names, requests and amounts are exactly as in the Sheet.

## Files

- `index.html`: the whole site (student view, and the teacher view at `?teacher`)
- `Code.gs`: the Google Apps Script backend, which stores each group's budget in a Google Sheet

## How it's set up

The backend is the Google Sheet "City Budget datasheet," with `Code.gs` attached through **Extensions > Apps Script** and deployed as a web app (**Execute as: Me**, **Who has access: Anyone**). Its `/exec` URL goes in `CONFIG.API_URL` in `index.html`. The site is served by GitHub Pages from the main branch.

There's one simulation for everyone; nothing carries over between classes once you reset it. The teacher view has no PIN, so anyone who adds `?teacher` to the address can open it. Its **Reset for everyone** button doesn't delete anything: it moves every group's row to the Archive tab.

**Changing the backend:** edit the code in the Apps Script editor, then publish it with **Deploy > Manage deployments > Edit > Version: New version**. That keeps the same URL. **New deployment** creates a different URL, which you would then have to paste into `index.html`. Copy any changes back into `Code.gs` here so the repo stays current.

**Checking the backend:** opening the `/exec` URL in a private window should show `{"ok":false,"error":"Unknown action."}`. A Google sign-in page means access isn't set to "Anyone."

**Trying it without the Sheet:** with `API_URL` set to `''`, open `index.html` in a browser. Demo mode stores everything in that one browser, so a student tab and a `?teacher` tab side by side behave like a class.

## Starting in a new Sheet

1. Create a blank Google Sheet, open **Extensions > Apps Script**, and paste in `Code.gs`.
2. Choose `setup` in the function menu, click **Run**, and approve the permissions. The Control, Budgets and Archive tabs appear. The Sheet's original "Sheet1" tab isn't used; you can delete it.
3. **Deploy > New deployment > Web app**, with **Execute as: Me** and **Who has access: Anyone**. ("Anyone within your school" makes students sign in, which blocks the site from reaching the script.)
4. Paste the new `/exec` URL into `CONFIG.API_URL` in `index.html` and commit.

## Running it in class

1. Before class, open the teacher view and choose **Reset for everyone** so the last class's budgets are cleared. Students open the plain address, pick their group number, and choose **Open our budget**.
2. **Setting up the city.** Each group names its city, then answers four questions, one screen at a time: Is it urban, suburban or rural? What keeps it running (industry-focused, bedroom community, or service center)? Who lives there (mostly working-class, mixed-income, or mostly wealthy)? Where is it (on the coast, in the hills, or in a valley, each with its own environmental risk)? Groups can go back and change answers until they choose **See our budget**. From then on the answers are final, so groups live with their choices.

   The last screen sums up the city in a sentence and shows how each choice changed the comptroller's starting budget, one line per choice with the reason, then the final budget. The effects are moderate (between about −19% and +17% in total):

   | Question | Choices and effects |
   |---|---|
   | Setting | Urban +5%, Suburban 0, Rural −5% |
   | Economy | Industry-focused +6%, Bedroom community −4%, Service center +2% |
   | Residents | Mostly working-class −6%, Mixed-income 0, Mostly wealthy +8% |
   | Location | On the coast −4%, In the hills −3%, In a valley −3% |

   Groups can still fix their city's name with **Rename city**, and can reopen the breakdown under their budget at any time.
3. **Budgets.** The first time a group opens the site, it gets a random starting budget from the list in the Google Doc ($4,000,000, $3,000,000, $2,750,000, $2,500,000, $2,500,000, $2,250,000, $2,000,000), with no repeats until the list runs out. One group will have more than enough; the rest won't. To give a group a different starting amount, change it in the Starting budget menu on the Progress tab. The group's choices are applied to the new amount, and its screen updates within about 15 seconds.
4. **Deciding.** Groups mark each request **Deny**, **Fund** (the full amount), or type a partial amount. The bar at the bottom of their screen keeps the totals from the Sheet: total requested, budgeted, total granted and variance. Every change saves on its own. When the budget is within the comptroller's amount, a group can choose **Submit our budget**; **Keep editing** reopens it.
5. **Watching progress.** The Progress tab shows each group's city and profile, starting budget, budget after choices, total granted, variance, how many of the 56 requests it has decided, and whether it has submitted.
6. **Priorities.** The Priorities tab shows:
   - **Class priorities:** the average share of each department's request that groups granted, ranked.
   - **By city type:** the same averages split by the answer to one profile question (for example rural vs urban cities, or working-class vs wealthy ones).
   - **Group by group:** a heat map of the share each group granted, by department or (with **Projects**) by individual request, with a class average column.
   - **Where each budget went:** each group's grants by department against its budget.
   - **Matched requests:** the requests that are identical except for the neighborhood (tree planting near the Presidio and near Hunters Point; fire station equipment in Forest Hill and in Bayview-Hunters Point; crime prevention in high-value and in high-crime neighborhoods), with how many groups funded, partly funded or denied each.
7. **Wrapping up.** Choose **Lock budgets** so groups can't keep changing them while the class talks or does the exit ticket. **Unlock budgets** reopens editing.

**Reset for everyone** starts a fresh simulation for the next class. It moves every group's budget to the Archive tab, unlocks budgets, and sends any open student screens back to the group picker. Groups get new random budgets when they open the site again.

## Settings

In `index.html` (`CONFIG`):

- `GROUP_COUNT`: how many group numbers students see (7 matches the seven budgets in the Doc)

The departments and requests are in `DEPARTMENTS`, just below `CONFIG`. The city-profile questions and choices are in `PROFILE`; the Sheet stores the choice labels, so rename a choice only between resets. Saved budgets refer to requests by their position, so don't reorder or delete requests while a class is using the site; add new ones at the end of a department.

In `Code.gs`:

- `BUDGETS`: the starting amounts groups are given at random
- `EFFECTS`: how much each city-profile choice raises or lowers the starting budget, and the reason students see. Choice names must match `PROFILE` in `index.html`. (Demo mode keeps its own copy in `index.html`, under `Local.EFFECTS`.)

## Privacy

No names or logins. The Sheet stores the group number, city name and profile, and the amounts each group granted. Archived rows record when they were reset, so you can tell classes apart there if you need to.

## Credits and license

Developed by Eric E Castro. Released under CC0 1.0 Universal (see `LICENSE`), so anyone may copy, adapt and reuse it without asking.
