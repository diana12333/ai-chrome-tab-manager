# AI Tab Organizer

A Chrome extension that uses Gemini AI to intelligently organize your browser tabs and suggest tabs to close.

## Features

### 1. Smart Tab Grouping
- Analyzes tab content, URLs, and metadata
- Groups tabs by topic, domain, and content similarity
- Creates color-coded Chrome tab groups
- Considers both same-root domains and related content across different sites
- **NEW**: Reads existing tab groups and suggests adding tabs to them
- **NEW**: Custom keywords input - guide the AI to create specific group names
- **NEW**: Visual badges show "EXISTING" (green) vs "NEW" (blue) groups

### 2. Interactive Tab Preview
- **Hover tooltips**: Hover over any tab to see a quick preview with URL, description, and content
- **Expandable details**: Click on any tab to expand and see full details including:
  - Favicon
  - Full URL
  - Meta description
  - Content preview (first 200 characters)
  - Quick actions (Switch to Tab, Close Tab)
- **Visual feedback**: Smooth animations and color-coded indicators

### 3. Smart Close Suggestions
- Identifies duplicate content across tabs
- Detects likely finished tasks (completed purchases, read articles)
- Finds redundant tabs where one has more comprehensive info
- Conservative suggestions - only clearly closeable tabs

### 4. Content-Aware Analysis
- Extracts page meta descriptions
- Reads first 1000 characters of visible text
- Analyzes actual page content, not just titles
- Works with all HTTP/HTTPS pages

## Installation

1. Get a Gemini API key from https://aistudio.google.com/apikey
2. Open Chrome and go to `chrome://extensions/`
3. Enable "Developer mode" (top right toggle)
4. Click "Load unpacked"
5. Select the `tab-organizer-extension` folder
6. Click the extension icon and enter your API key

## Usage

1. **Enter API Key**: First time only, enter your Gemini API key and click "Save Key"
2. **Optional - Custom Keywords**: Enter comma-separated keywords (e.g., "Work, Shopping, Research") to guide group names
3. **Optional - Existing Groups**: Check/uncheck "Consider existing tab groups" to include or ignore current groups
4. **Analyze Tabs**: Click "Analyze & Organize Tabs" to group your tabs
   - AI will suggest adding tabs to existing groups (green badge) or creating new ones (blue badge)
5. **Preview Tabs**:
   - Hover over any tab to see a quick preview tooltip
   - Click on a tab to expand and see full details
6. **Apply Grouping**:
   - Click "Add to Existing Group" to add tabs to an existing group
   - Click "Create Chrome Tab Group" to create a new group
7. **Close Suggestions**: Click "Suggest Tabs to Close" to find closeable tabs

## UI/UX Features

- **Hover Preview Tooltips**: Shows URL, description, and content preview on hover
- **Expandable Tab Cards**: Click to expand and see full details
- **Tab Actions**: Quick buttons to switch to or close individual tabs
- **Favicon Display**: Shows website icons for easy recognition
- **Dark Theme**: Easy on the eyes with smooth animations
- **Responsive Design**: Clean, modern interface

## Privacy

- Content extraction happens locally in your browser
- Only tab metadata and content previews are sent to Gemini API
- API key stored locally in Chrome storage
- No data is stored on external servers

## Requirements

- Chrome browser
- Gemini API key (free tier available)
- Internet connection for API calls

## Version History

- **1.3.0**: Added existing group detection, custom keywords input, and smart group suggestions
  - Reads existing tab groups (open and collapsed)
  - AI can suggest adding to existing groups or creating new ones
  - Custom keywords input for user-defined group names
  - Visual indicators for existing vs new groups
- **1.2.0**: Added interactive preview features (hover tooltips, expandable details, favicons)
- **1.1.0**: Added content extraction and enhanced AI analysis
- **1.0.0**: Initial release with basic grouping

## Technical Details

- Uses Chrome Extensions Manifest V3
- Gemini 2.0 Flash model for fast, accurate analysis
- Content scripts for page content extraction
- Chrome Tabs and Tab Groups API for organization
