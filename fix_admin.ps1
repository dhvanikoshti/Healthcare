$content = Get-Content "d:\Internship\Project\healthcare\src\pages\AdminDashboard.jsx" -Raw
$content = $content -replace 'style=\{\{ backgroundColor: r\.color, width: "`\$\{\(r\.count / 350\) \* 100\}%`" \}\}></div>', 'style={{ backgroundColor: r.color, width: `${(r.count / 350) * 100}%` }}></div>'
Set-Content "d:\Internship\Project\healthcare\src\pages\AdminDashboard.jsx" $content -NoNewline
