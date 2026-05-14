# Changelog

All notable changes to **GlassHub** are documented in this file.

The format is inspired by Keep a Changelog and organized by version.

## [1.1]

### Added
- Added bookmark management, allowing users to create and delete shortcuts directly from the settings modal.
- Added automatic favicon retrieval based on each shortcut URL, removing the need for a manual favicon refresh action.
- Added a toggle for 12-hour time display with AM/PM.

### Changed
- Improved shortcut customization by simplifying shortcut editing to name + URL for main links and URL-only for small links, while icons are generated automatically.
- Streamlined settings management for a cleaner and easier customization workflow.

### Removed
- Removed the slideshow feature because it added too much complexity and unnecessary code weight.
- Removed the manual favicon refresh workflow, now replaced by automatic favicon generation.

## [1.0]

### Added
- Initial release of GlassHub for Firefox.
- Added a glassmorphism-based new tab dashboard that replaces the default Firefox new tab page.
- Added a real-time clock with live date display.
- Added customizable welcome messages displayed on the new tab page.
- Added a search bar that supports Google search and direct URL navigation.
- Added browser-history-based autocomplete suggestions in the search bar.
- Added customizable main shortcuts and small shortcuts stored locally.
- Added drag-and-drop reordering for shortcuts and welcome messages in the settings modal.
- Added custom background support through image upload or image URL.
- Added a weather widget powered by Open-Meteo with city search and cached results.
- Added import and export of configuration through JSON files.
- Added local-first storage for personalization settings using the browser's local storage.
- Added Firefox integration for new tab override and homepage override.

### Notes
- Version 1.0 established the core customization experience of the extension, including search, shortcuts, greetings, weather, background personalization, and configuration portability.
