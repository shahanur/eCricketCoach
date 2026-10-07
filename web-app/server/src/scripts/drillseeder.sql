-- Source: Ekota_Drills_From_Images.csv (35 drills).
-- Blank Duration values use 20 minutes. All drills are shared GROUP activities.
-- Focus maps to skill_set; instructions retain labelled Focus, Setup, and Safety.
-- Multi-discipline values are preserved, uppercase and slash-separated.
-- CSV IDs are required by public.drills and allow safe reruns without overwrites.
BEGIN;

WITH csv_drills (id, title, discipline, focus, setup, safety, duration) AS (
    VALUES
    (
        '4feff020-5d61-4d4b-9a43-4c62ab6e97b6',
        'Mechanics Groove Drill',
        'FIELDING',
        'Short distance, high-rep, controlled throws focusing on form.',
        'Short-distance throwing lane marked with cones and a net target. Image reference: Week 1 (Image 1).',
        'Wait for ''all clear'' before throwing.; Throw only in designated lanes.; Clear ball return area.; Warm up properly (focusing on shoulder mobility).; Maintain controlled power.; Inspect all equipment.',
        20
    ),
    (
        'ba28ad51-5b22-48a5-b40a-849384dd6425',
        'Distance & Accuracy Progression Drill',
        'FIELDING',
        'Controlled throws to different distant targets with step-ups as form holds.',
        'Step-up throwing markers set at staggered intervals (5m, 10m, 15m, 20m) facing elevated target nets. Image reference: Week 1 (Image 1).',
        'Wait for ''all clear'' before throwing.; Throw only in designated lanes.; Clear ball return area.; Warm up properly (focusing on shoulder mobility).; Maintain controlled power.; Inspect all equipment.',
        20
    ),
    (
        '7ead2382-e6de-42a8-93ba-9cd9607235d2',
        'Target Challenge Drill',
        'FIELDING',
        'Throwing for points to specific target zones.',
        'Circular scoring targets on a net; throw from marked positions. Image reference: Week 1 (Image 1).',
        'Wait for ''all clear'' before throwing.; Throw only in designated lanes.; Clear ball return area.; Warm up properly (focusing on shoulder mobility).; Maintain controlled power.; Inspect all equipment.',
        20
    ),
    (
        '0d283c72-6b18-4f94-b484-9cbf486ebf0e',
        'Target Focus Lanes Drill',
        'BOWLING',
        'Rotate players through target focus lanes evaluating wickets, line, length, and release height.',
        'Separate net lanes targeting wickets, line, length and release height. Image reference: Week 2 (Image 2).',
        'Wait for ''all clear'' in lane.; Clear ball return area in net before next ball.; Warm up properly.; Inspect all equipment.; Use correct indoor footwear.',
        20
    ),
    (
        '0136ff09-e414-40e8-9de2-21a30f49dd8b',
        'Line/Length Target Grid Drill',
        'BOWLING',
        'Detailed line and length target grid bowling.',
        'Net lane with pitch floor carpet marked with color-coded line (Off, Middle, Leg) and length (Short, Good, Full) zones. Image reference: Week 2 (Image 2).',
        'Wait for ''all clear'' in lane.; Clear ball return area in net before next ball.; Warm up properly.; Inspect all equipment.; Use correct indoor footwear.',
        20
    ),
    (
        '7cbb23ca-d4b8-46e7-8ca3-c717cc9ed568',
        'Precision Grid Challenge Drill',
        'BOWLING',
        'Point-scoring challenge on pitch target grid for varied combinations.',
        'Full pitch grid layout with distance markers (12m, 15m, 17m, 20m) mapped to a point system (5 to 20 points). Image reference: Week 2 (Image 2).',
        'Wait for ''all clear'' in lane.; Clear ball return area in net before next ball.; Warm up properly.; Inspect all equipment.; Use correct indoor footwear.',
        20
    ),
    (
        '1e985ee9-4df5-4526-bc1c-80442d691fda',
        'Release Consistency Drill',
        'BOWLING',
        'Focus on repeatable release point in height grid.',
        'Net lane with a release-height reference grid and target. Image reference: Week 3 (Image 3).',
        'Wait for ''all clear'' before next ball.; Controlled follow-through is vital to balance full-action delivery.; Inspect all equipment for damage.; Proper footwear required for full-pace run-ups.; Proper warm-up, focus on shoulder mobility.',
        20
    ),
    (
        '646ac3a0-e108-4a06-a71b-5948a476baa8',
        'Grip & Rhythm Groove Drill',
        'BOWLING',
        'Short distance target practice, seamless grip changes, consistent run-up rhythm, and toss-ups (e.g., toss-up 10m to a catcher).',
        'Shortened 10-meter open corridor with marked crease lines and a target/catcher. Image reference: Week 3 (Image 3).',
        'Wait for ''all clear'' before next ball.; Controlled follow-through is vital to balance full-action delivery.; Inspect all equipment for damage.; Proper footwear required for full-pace run-ups.; Proper warm-up, focus on shoulder mobility.',
        20
    ),
    (
        '139b98d3-ecd3-4b93-9706-31afe28a4d02',
        'Nets & Variation Challenge Drill',
        'BOWLING',
        'Full action bowling targeting good length with declared variations (e.g., slower ball).',
        'Full-length bowling net with marked Good Length pitch zones and declared variation call-out area. Image reference: Week 3 (Image 3).',
        'Wait for ''all clear'' before next ball.; Controlled follow-through is vital to balance full-action delivery.; Inspect all equipment for damage.; Proper footwear required for full-pace run-ups.; Proper warm-up, focus on shoulder mobility.',
        20
    ),
    (
        'c2865634-af14-467b-bf6c-cf4a05578356',
        'Grip & Stance / Shadow Batting Drill',
        'BATTING',
        'Shadow batting form check focusing on grip, stance, and balance.',
        'Crease and stumps in a separated shadow-batting station; coach checks grip and stance. Image reference: Week 4 (Image 4).',
        'Check all protective gear (helmet, pads, gloves).; Ensure net dividers are secure.; Warm up properly for hips and back.; Clear batting area.; Use correct protective gear.',
        20
    ),
    (
        '213b074f-33bf-4e45-8c22-1a9bde7b44ed',
        'Controlled Sweeps Drill',
        'BATTING',
        'Controlled sweep execution off ball drops.',
        'Batting crease setup with a partner/feeder dropping soft balls at designated landing spots. Image reference: Week 4 (Image 4).',
        'Check all protective gear (helmet, pads, gloves).; Ensure net dividers are secure.; Warm up properly for hips and back.; Clear batting area.; Use correct protective gear.',
        20
    ),
    (
        '98ccbb8b-5686-461f-b7cf-b72adfb11bf8',
        'Precision Sweep Grid Drill',
        'BATTING',
        'Full sweep action aimed at targeted grid zones in net.',
        'Enclosed net with floor target grid divided into Leg Side Gap (20pts), Fine Sweep (10pts), Reverse Sweep (15pts), and Square Leg (10pts). Image reference: Week 4 (Image 4).',
        'Check all protective gear (helmet, pads, gloves).; Ensure net dividers are secure.; Warm up properly for hips and back.; Clear batting area.; Use correct protective gear.',
        20
    ),
    (
        '7a5c411b-03a9-4bd1-8bd0-01cb2800425d',
        'Advanced Sweep Match Scenario Drill',
        'BATTING',
        'Sweep variations in match/pressure scenarios.',
        'Full net with bowler/feeder simulating spin deliveries and target zones active. Image reference: Week 4 (Image 4).',
        'Check all protective gear (helmet, pads, gloves).; Ensure net dividers are secure.; Warm up properly for hips and back.; Clear batting area.; Use correct protective gear.',
        20
    ),
    (
        '5b87c54b-6d2d-45f7-91e3-947e66397b99',
        'Front Foot Groove Drill',
        'BATTING',
        'Form check shadow/partner check for positive front foot movement.',
        'Designated stance floor markers with alignment lines showing proper front foot path. Image reference: Week 5 (Image 5).',
        'Check all protective gear (helmet, pads, gloves).; Ensure net dividers are secure.; Warm up properly for hips and back.; Clear batting area.; Use correct protective gear.',
        20
    ),
    (
        '96a0c5a2-c3a2-409a-b751-cd088529aec6',
        'Weight Transfer Tee Drill',
        'BATTING',
        'Target practice off static batting tees focusing on power/weight transfer.',
        'Static batting tees aligned at off-drive angles with target cones ahead. Image reference: Week 5 (Image 5).',
        'Check all protective gear (helmet, pads, gloves).; Ensure net dividers are secure.; Warm up properly for hips and back.; Clear batting area.; Use correct protective gear.',
        20
    ),
    (
        '69f6e116-705a-4e40-afa3-5917b23c6b76',
        'Precision Off Drive Grid Drill',
        'BATTING',
        'Net target practice to hit specific off-side sets.',
        'Enclosed net with an Off Drive Grid marking Point Boundary (20pts), Cover Boundary (15pts), Mid-Off Target (25pts), and Off Side Target (10pts). Image reference: Week 5 (Image 5).',
        'Check all protective gear (helmet, pads, gloves).; Ensure net dividers are secure.; Warm up properly for hips and back.; Clear batting area.; Use correct protective gear.',
        20
    ),
    (
        'ab0ab75f-7f9c-4555-9ee3-9750e59fc8e6',
        'Match Scenario Gap Driving Drill',
        'BATTING',
        'Driving through gaps in simulated field conditions.',
        'Open/net setup with field markers set up in off-side gap positions. Image reference: Week 5 (Image 5).',
        'Check all protective gear (helmet, pads, gloves).; Ensure net dividers are secure.; Warm up properly for hips and back.; Clear batting area.; Use correct protective gear.',
        20
    ),
    (
        '7fae7055-fcfb-40a0-9b37-a11a00cd9d9c',
        'Quick Hands Drill',
        'FIELDING',
        'Pick & set drill with form checks for rapid pickup.',
        'Pickup-and-set station with balls, cones and a marked working area. Image reference: Week 6 (Image 6).',
        'Ensure net dividers are secure.; Warm up properly for hips and back.; Use correct protective gear.',
        20
    ),
    (
        '6a7ff186-836c-4563-bedd-10e1bd58c442',
        'Direct Hit Target Throw Drill',
        'FIELDING',
        'Target throwing at direct-hit bullseyes.',
        'Target wall or stump frame with Bullseye (20pts), Wicketkeeper Zone (10pts), and Stump Zone (3pts) overlays. Image reference: Week 6 (Image 6).',
        'Ensure net dividers are secure.; Warm up properly for hips and back.; Use correct protective gear.',
        20
    ),
    (
        '8a8b8596-0fca-4df9-8723-3cb80325f982',
        'Precision Relay Race Drill',
        'FIELDING',
        'Relay race with quick-release throwing.',
        'Parallel sprint channels with relay transfer points marked by pairs of cones. Image reference: Week 6 (Image 6).',
        'Ensure net dividers are secure.; Warm up properly for hips and back.; Use correct protective gear.',
        20
    ),
    (
        'bbc77135-df70-4b6b-b08c-607fa7d979ab',
        'Scenario Play Under-Pressure Drill',
        'FIELDING',
        'Under-pressure fielding scenario challenge.',
        'Marked fielding station with target grid and controlled scenario feeds. Image reference: Week 6 (Image 6).',
        'Ensure net dividers are secure.; Warm up properly for hips and back.; Use correct protective gear.',
        20
    ),
    (
        '1f2927ef-4961-47da-b154-bf02eeebe158',
        'Bat to Run Groove Drill',
        'BATTING',
        'Explosive batting action transition into immediate sprint trigger.',
        'Batting crease set up directly adjacent to a sprint acceleration alley marked with cones. Image reference: Week 7 (Image 7).',
        'Check for clear pathways between complex areas.; Maintain awareness of other drills in close proximity.; Inspect all equipment for damage.; Warm up properly (hips and back).; Use correct protective gear.',
        20
    ),
    (
        'c2a25c2a-cd83-4974-acd7-aa6dc0983f33',
        'Field to Bowling Action Groove Drill',
        'FIELDING',
        'Ground pickup transitioning to accurate throw chain on the move.',
        'Diagonal field run approach leading to a pickup cone and target grid. Image reference: Week 7 (Image 7).',
        'Check for clear pathways between complex areas.; Maintain awareness of other drills in close proximity.; Inspect all equipment for damage.; Warm up properly (hips and back).; Use correct protective gear.',
        20
    ),
    (
        'a6641101-a8ab-44b1-b98e-a91a3fed14cb',
        'Throw to Collect Recovery Groove Drill',
        'FIELDING',
        'Post-throw running to recover a ball or reposition.',
        'Triangular cone pathway with throw target and designated recovery run zone. Image reference: Week 7 (Image 7).',
        'Check for clear pathways between complex areas.; Maintain awareness of other drills in close proximity.; Inspect all equipment for damage.; Warm up properly (hips and back).; Use correct protective gear.',
        20
    ),
    (
        'f31f285d-ea0b-4fb2-922d-03e3de9a5f9e',
        'Integrated Scenario Challenge Drill',
        'FIELDING / KEEPING',
        'Boundary relay chain drill involving multi-player coordination.',
        'Multi-player chain layout (Fielder to Relay to Wicketkeeper) with defined points zones (Green: 20pts, Yellow: 10pts, Red: 5pts). Image reference: Week 7 (Image 7).',
        'Check for clear pathways between complex areas.; Maintain awareness of other drills in close proximity.; Inspect all equipment for damage.; Warm up properly (hips and back).; Use correct protective gear.',
        20
    ),
    (
        '24bfb058-f79a-4a02-979e-d7081bd201ce',
        'Hit, Call & Sprint Drill',
        'BATTING',
        'Decisive shot execution, loud calling, and explosive sprint.',
        'Batting box connected to parallel sprint channels with timing triggers. Image reference: Week 8 (Image 8).',
        'Check pathways for clear sprints.; Ensure safe distance between drill areas.; Inspect equipment.; Use correct protective gear.',
        20
    ),
    (
        '7736cfc9-a73d-4ee4-b53b-db58e764fbb8',
        'Bowl, React & Attack Drill',
        'BOWLING / FIELDING',
        'Reacting to complex feeds and attacking the ball.',
        'Bowling station followed by controlled reaction feeds towards marked fielding positions. Image reference: Week 8 (Image 8).',
        'Check pathways for clear sprints.; Ensure safe distance between drill areas.; Inspect equipment.; Use correct protective gear.',
        20
    ),
    (
        'fe36dec1-9dfc-4216-a35e-3b76e30a0474',
        'Relay Link Drill',
        'FIELDING',
        'Connecting hit/call and reaction drills with sprint arrival and rapid throw.',
        'Middle link corridor connecting drill areas with marked target gates. Image reference: Week 8 (Image 8).',
        'Check pathways for clear sprints.; Ensure safe distance between drill areas.; Inspect equipment.; Use correct protective gear.',
        20
    ),
    (
        'd1ddcb34-f4d2-48f3-a03c-5feff17beafb',
        'Integrated Pressure Scenario Drill',
        'BATTING / BOWLING / FIELDING / KEEPING',
        'Integrated flow under pressure with multi-player coordination.',
        'Complete integrated scenario grid (Green: 20pts, Yellow: 10pts, Red: 5pts) with stopwatch timing. Image reference: Week 8 (Image 8).',
        'Check pathways for clear sprints.; Ensure safe distance between drill areas.; Inspect equipment.; Use correct protective gear.',
        20
    ),
    (
        '6d3d6f48-d730-45d9-8dad-d3863c252389',
        'Strike Rotation Groove Drill',
        'BATTING',
        'Gap detection, loud calling ("YES!"), and sprint completion.',
        'Semi-circular gap detection zone with target cones marked at 10pt and 20pt gaps. Image reference: Week 9 (Image 9).',
        'Ensure clear batting pathways.; Catcher/bowler protection.; Clear all batting areas of debris.; Check all protective gear.; Warm up back and shoulders.',
        20
    ),
    (
        'bd801516-a9eb-40ca-8131-80448741d3cb',
        'Cut Shot Mastery Drill',
        'BATTING',
        'Static tees and bowling machine short-delivery cut shot practice.',
        'Bowling machine / static tees positioned for short balls facing Point Gap, Covers Gap (15pts), and Deep Point Zone (10pts). Image reference: Week 9 (Image 9).',
        'Ensure clear batting pathways.; Catcher/bowler protection.; Clear all batting areas of debris.; Check all protective gear.; Warm up back and shoulders.',
        20
    ),
    (
        'd0e09746-f3d0-4de8-be2b-e90ce0ac2855',
        'Combined Scenario Drill',
        'BATTING',
        'Decision making between rotation singles and boundary cuts.',
        'Combined sequence flow layout linking gap detection calls directly to short-ball delivery options. Image reference: Week 9 (Image 9).',
        'Ensure clear batting pathways.; Catcher/bowler protection.; Clear all batting areas of debris.; Check all protective gear.; Warm up back and shoulders.',
        20
    ),
    (
        '2487004c-fd16-4806-8a39-9fcb83bfb991',
        'Close Catching Reflexes & Reaction Drill',
        'FIELDING',
        'Rapid catching drills using reaction boards.',
        'Reaction boards positioned at close-catching distance with numbered trajectory zones (1: Read Edge, 2: Body Coil, 3: Rapid Hand, 4: Soft Hands, 5: Return Throw). Image reference: Week 10 (Image 10).',
        'Check close-fielding pathways, ensure adequate protective gear, clear debris.; Check all protective gear.; Warm up back and shoulders.; JPG',
        20
    ),
    (
        '023e555b-1497-4acf-a27d-5696ab373a33',
        'Backfoot Drive Mastery Drill',
        'BATTING',
        'Machine and static tee backfoot drive precision drill.',
        'Bowling machine / static tees set up for short/good length deliveries facing Cover Gap (20pts), Cover Gap (15pts), Deep Point (10pts), and Fielder Zones (5pts). Image reference: Week 10 (Image 10).',
        'Check close-fielding pathways, ensure adequate protective gear, clear debris.; Check all protective gear.; Warm up back and shoulders.; JPG',
        20
    ),
    (
        'e5e392f1-30f5-415a-bd07-82b5e9aaf5e3',
        'Integrated Scenario Combined Decision Drill',
        'BATTING / FIELDING',
        'Real-time transition between edge-catch reactions and backfoot drive execution.',
        'Dual-action layout linking close slip-catching feed directly into a backfoot drive sequence flow. Image reference: Week 10 (Image 10).',
        'Check close-fielding pathways, ensure adequate protective gear, clear debris.; Check all protective gear.; Warm up back and shoulders.; JPG',
        20
    )
)
INSERT INTO public.drills (
    id,
    title,
    discipline,
    skill_set,
    context_type,
    duration,
    source,
    club_id,
    club_name,
    squad_id,
    squad_name,
    instructions,
    image_url
)
SELECT
    id,
    title,
    discipline,
    focus,
    'GROUP',
    duration,
    'SYSTEM_PREDEFINED',
    NULL,
    NULL,
    NULL,
    NULL,
    setup,
    NULL
FROM csv_drills
ON CONFLICT (id) DO NOTHING;

COMMIT;
