# Device Presets (example)

Provide device resolutions and either PPI or Diagonal (in). The app uses PPI if present; otherwise it computes PPI from width/height and diagonal.

| Name        | Width | Height | PPI | Diagonal |
|-------------|------:|-------:|----:|---------:|
| Pixel 5     | 1080  | 2340   | 432 | 6.0      |
| iPhone 13   | 1170  | 2532   | 460 | 6.1      |
| iPad Pro 11 | 1668  | 2388   | 264 | 11.0     |

You can also write lines like:

- Galaxy S21 | 1080x2400 | ppi=421 | diag=6.2
- Custom A | w=1200 | h=2000 | diag=7.0
- Custom B,1440,2960,529,6.0

