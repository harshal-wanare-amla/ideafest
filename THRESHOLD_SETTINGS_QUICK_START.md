# 🎯 Quick Start: Threshold Settings

## Where to Find It

### Via Dashboard:
1. Navigate to `http://localhost:5174/dashboard`
2. Look for the **⚙️ Thresholds** button in the top navigation bar
3. Click it to open the Threshold Configuration page

### Direct Access:
- **URL**: `http://localhost:5174/settings/thresholds`

---

## What You Can Do

### 1. **View All Thresholds**
- 13 rules across 8 different metrics
- Color-coded by priority (Red = High, Orange = Medium, Blue = Low)
- Each rule shows its current configuration

### 2. **Adjust Values**
Click into any field to edit:

| Field | Example | Purpose |
|-------|---------|---------|
| **Threshold Value** | 20 | Condition value (e.g., "zero results >= 20") |
| **Minimum Searches** | 20 | Minimum queries to trigger rule |
| **Revenue Multiplier** | 150 | $ impact per occurrence |
| **Action Type** | Add Inventory | What action to recommend |

### 3. **Enable/Disable Rules**
- Click the 🔔 icon to enable/disable any rule
- Active rules = 🔔 (bell on)
- Inactive rules = 🔕 (bell off)

### 4. **Filter & Search**
- **Priority Filter**: HIGH, MEDIUM, LOW
- **Metric Filter**: zero_result_count, ctr, refinement_rate, etc.
- Shows "X of Y rules" matching filters

### 5. **Save Changes**
- **Save Button**: 💾 Save All Changes (turns green when changes exist)
- **Reset Button**: ↩️ Reset (clears all unsaved changes)
- **Success Message**: ✅ Appears when changes saved

---

## Example: Change Zero-Result Threshold

**Current Setting**: Triggers when zero results >= 20

**Want to change** to >= 30 searches?

1. Find "Zero Result Opportunity - High Volume" card
2. Change **Threshold Value** from 20 → 30
3. Field turns yellow 📝 (shows it changed)
4. Click **💾 Save All Changes**
5. ✅ "Successfully updated!" message appears

---

## Current Rules Summary

### 🔴 HIGH Priority (5 rules)
- Zero Result Opportunity - High Volume (threshold: 20)
- Zero Result Opportunity - Critical (threshold: 50)
- Critical Low CTR (threshold: 0.05)
- Critical High Refinement Rate (threshold: 0.4)
- Critical Poor Ranking (threshold: 6)

### 🟡 MEDIUM Priority (6 rules)
- Low CTR Warning (threshold: 0.15)
- High Refinement Rate Warning (threshold: 0.25)
- Poor Ranking Warning (threshold: 4)
- Niche Product - Low Engagement (threshold: 50)
- Low Results Available (threshold: 5)
- Scroll Depth Decline (threshold: 0.3)

### 🔵 LOW Priority (2 rules)
- High Volume Strong CTR - Winner
- High Engagement Queries - Strong Performance

---

## API Access (For Developers)

Get current thresholds:
```bash
curl http://localhost:5000/api/rules/config
```

Update a specific rule:
```bash
curl -X PATCH http://localhost:5000/api/rules/zero_result_high_volume \
  -H "Content-Type: application/json" \
  -d '{"threshold": 30}'
```

Reset to defaults:
```bash
curl -X POST http://localhost:5000/api/rules/reset
```

---

## 💡 Tips

✅ **Changes are Persistent** - Saved to disk, survive server restarts
✅ **Real-time Highlights** - Modified fields turn yellow
✅ **Error Recovery** - Retry button if save fails
✅ **Mobile Friendly** - Works on phones and tablets
✅ **Easy Reset** - Click Reset to undo all changes before saving

---

## Troubleshooting

**Q: Changes not saving?**
- Check for error messages (red banner)
- Click "🔄 Retry" button
- Verify backend is running on port 5000

**Q: Page shows "Loading..."?**
- Wait 5 seconds
- Refresh the page (Ctrl+R)
- Check browser console for errors

**Q: Can't see rules?**
- Make sure filters are set to "All"
- Try clearing browser cache (Ctrl+Shift+Del)
- Restart both servers

---

## Production Deployment

When deploying:
1. Thresholds saved to `backend/src/rules-config-user.json`
2. Copy this file to preserve custom settings
3. On new server, place file before starting
4. All thresholds load automatically on startup
