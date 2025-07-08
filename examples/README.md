# Examples

This directory contains sample files for testing and understanding the EMS pipeline.

## Sample EMS File

`sample.ems` - A representative CCC EMS file showing the format and structure:

- **H Line**: Header with estimate/claim numbers and dates
- **V Line**: Vehicle information (VIN, make, model, year)
- **I Line**: Insurance information
- **L Lines**: Line items with parts, labor, and costs
- **P Lines**: Parts data with numbers and pricing
- **T Line**: Totals breakdown
- **N Lines**: Notes and comments
- **A Line**: Adjuster information
- **D Line**: Damage assessment
- **R Line**: Repair procedures

## Testing the Pipeline

1. Copy `sample.ems` to your CCC export directory
2. The pipeline will automatically detect and process it
3. Check the Supabase database for the imported estimate
4. Review logs for processing details

## EMS Format Reference

Each line starts with a single character identifier:

| Code | Description | Example |
|------|-------------|---------|
| H | Header | `H\|EST2024001\|CLM2024001\|03/15/2024\|...` |
| V | Vehicle | `V\|1HGBH41JXMN109186\|2022\|Toyota\|Camry\|...` |
| I | Insurance | `I\|GEICO\|POL123456789\|CLM2024001\|500.00\|...` |
| L | Line Item | `L\|1\|replace\|Front Bumper Cover\|52119-06921\|...` |
| P | Parts | `P\|52119-06921\|Front Bumper Cover\|52119-06921\|...` |
| T | Totals | `T\|280.50\|534.00\|0.00\|65.28\|879.78\|...` |
| N | Notes | `N\|general\|Vehicle sustained front-end collision\|...` |
| A | Adjuster | `A\|Sarah Johnson\|(555) 123-4567\|...` |
| D | Damage | `D\|Front End\|Moderate\|Impact damage\|...` |
| R | Repair | `R\|Remove and Install\|R&I front bumper\|...` |

Fields are separated by pipe (`|`) characters. 