import { ProgressTracker } from './../util/progress';
import { GoldensService } from './../service/goldens.service';
import {
  ChangeDetectionStrategy, ChangeDetectorRef, Component, DoCheck,
  ElementRef, HostListener, OnDestroy, OnInit, signal, ViewChild
} from '@angular/core';
import { MatToolbarModule } from '@angular/material/toolbar';
import { TestListComponent } from '../test-list/test-list.component';
import { PreviewComponent } from '../preview/preview.component';
import { TimelineComponent } from '../timeline/timeline.component';
import { GerritLinkPair, MotionGolden, PresubmitTest, DataSource, MotionGoldenData } from '../model/golden';
import { TestResult } from '../model/enums';
import { finalize, Subscription } from 'rxjs';
import { NgIf, NgStyle } from '@angular/common';
import {
  trigger,
  state,
  style,
  animate,
  transition,
  AnimationEvent
} from '@angular/animations';

import { DialogContentComponent } from '../dialog/dialog.component';
import { CodeSearchDialogComponent } from '../dialog/code-search-dialog.component';
import { UserJsonDialogComponent } from '../dialog/user-json-dialog.component';
import { MatButton, MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { TestModeComponent } from '../testMode/test-mode.component';
import { PreviewService } from '../service/preview.service';
import { ErrorService } from '../service/error.service';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TestModes } from '../model/test_mode';
import { DIVIDER_HEIGHT, MIN_PANEL_HEIGHT, MIN_PANEL_WIDTH } from '../model/constants';
import { AnimationEventPhasename, AnimationEventTime } from '../model/constants';
import { TestListPanelDimensionsFactor, VideoPanelDimensionsFactor } from '../model/constants';
@Component({
  selector: 'app-root',
  imports: [
    MatToolbarModule,
    TestListComponent,
    PreviewComponent,
    TimelineComponent,
    NgIf,
    MatButton,
    MatProgressSpinnerModule,
    MatIconModule,
    MatMenuModule,
    MatButtonModule,
    TestModeComponent,
    MatTooltipModule
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
  animations: [
    trigger('sidebarMenuAnimation', [
      state('void', style({
        width: '0',
        opacity: 0,
        overflow: 'hidden'
      })),
      transition(':enter', [
        style({ width: '0', opacity: 0 }),
        animate(`${AnimationEventTime.ENTRY_TIME}ms ease-out`, style({ width: '*', opacity: 1 }))
      ]),
      transition(':leave', [
        style({ width: '*', opacity: 1 }),
        animate('250ms ease-in', style({ width: '0', opacity: 0 }))
      ])
    ]),

    trigger('collapseAnimation', [
      state('void', style({
        height: '0',
        opacity: 0,
        overflow: 'hidden'
      })),

      state('*', style({
        height: '*',
        opacity: 1,
        overflow: 'hidden'
      })),

      transition(':enter', [
        animate(`${AnimationEventTime.ENTRY_TIME}ms ease-out`)
      ]),

      transition(':leave', [
        animate('300ms ease-in')
      ])
    ]),
    trigger('timelineHeightChange', [
      state('true', style({ height: 'calc(66.6666% - 16px)' })),
      state('false', style({ height: '100%' })),
      transition('true <=> false', [
        animate('300ms ease-in-out')
      ])
    ])
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent implements DoCheck, OnInit, OnDestroy {
  constructor(
    private goldenService: GoldensService,
    private progressTracker: ProgressTracker,
    public dialog: MatDialog,
    private errorService: ErrorService,
    private snackBar: MatSnackBar,
    private previewService: PreviewService,
    private cdr: ChangeDetectorRef,
  ) { }

  private errorSubscription!: Subscription;

  @ViewChild('appContainer') appContainer!: ElementRef<HTMLDivElement>;
  @ViewChild('testDisplayPanelContainer') testDisplayPanelContainer!: ElementRef<HTMLDivElement>;
  @ViewChild('testListPanel') testListPanel!: ElementRef<HTMLDivElement>;
  @ViewChild('videoPanel') videoPanel!: ElementRef<HTMLDivElement>;

  onAnimationDone(event: AnimationEvent) {
    if (event.phaseName === AnimationEventPhasename.DONE
      && event.totalTime === AnimationEventTime.ENTRY_TIME) { // when the animation ended
      if (this.testListPanel && this.testListPanel.nativeElement) { // for entry animation
        const containerWidth = this.appContainer.nativeElement.offsetWidth;
        this.testListPanelWidth.set(
          containerWidth * TestListPanelDimensionsFactor.DEFAULT_WIDTH
        );
      }
      if (this.videoPanel && this.videoPanel.nativeElement) { // for entry animation
        const containerHeight = this.testDisplayPanelContainer.nativeElement.offsetHeight;
        this.videoPanelHeight.set(
          containerHeight * VideoPanelDimensionsFactor.DEFAULT_HEIGHT
        );
      }
    }
  }

  // State for Horizontal Resizing
  private initialMouseX = signal(0);
  private initialTestListPanelWidth = signal(0);
  private isVerticalResizing = signal(false);
  private testListContainer = signal(0);
  public testListPanelWidth = signal(0); // reactive state variable to set initial width.

  //State for Vertical Resizing
  private initialMouseY = signal(0);
  private initialVideoPanelHeight = signal(0);
  private isHorizontalResizing = signal(false);
  private videoPanelContainer = signal(0);
  public videoPanelHeight = signal(0); // reactive state variable to set initial height.

  graphPanelHeight(): number {
    const totalHeight = this.testDisplayPanelContainer?.nativeElement?.offsetHeight || 0;
    const remainingHeight = totalHeight - this.videoPanelHeight() - DIVIDER_HEIGHT;
    return Math.max(remainingHeight, MIN_PANEL_HEIGHT);
  };

  testDisplayPanelWidth(): number {
    const containerWidth = this.appContainer?.nativeElement.offsetWidth || 0;
    return Math.max(containerWidth - this.testListPanelWidth(), MIN_PANEL_WIDTH);
  }

  isNullOrEmpty(obj: any): Boolean {
    return (obj == null || obj.length == 0)
  }
  testModes: string[] = []

  switchMode(mode: string) {
    this.showLoaderBar()
    this.resetVariables()
    this.testMode = mode
    const response = this.goldenService.switchMode(mode)
      .pipe(finalize(() => this.hideLoaderBar()))
    if (mode === TestModes.PRESUBMIT) {// test names list expected instead of goldens
      response
        .subscribe({
          next: (fetchedPresubmitTests) => {
            this.handlePresubmitSuccess(fetchedPresubmitTests as PresubmitTest[])
          },
          error: (err) => {
            this.showErrorAlert(err)
          }
        })
    } else {
      response
        .subscribe((goldens) => {
          this.goldens = goldens as MotionGolden[]
        });
    }
  }

  private handlePresubmitSuccess(fetchedPresubmitTests: PresubmitTest[]): void {
    const index = this.testModes.indexOf(TestModes.PRESUBMIT)
    if (this.isNullOrEmpty(fetchedPresubmitTests)) {
      fetchedPresubmitTests = []
      console.log("No artifacts found")
      this.snackBar.open("No artifacts found", 'Dismiss', {
        duration: 3000,
        horizontalPosition: 'center',
        verticalPosition: 'top'
      });
      if (index > -1) {// remove PRESUBMIT mode if it was previously inserted.
        this.testModes.splice(index, 1)
      }
    } else {
      if (index == -1) {// Add PRESUBMIT mode only when data is found and it was NOT present in the list
        this.testModes.push(TestModes.PRESUBMIT)
      }
    }
    this.presubmitTests = fetchedPresubmitTests
    this.testMode = TestModes.PRESUBMIT
  }

  resetVariables(): void {
    this.goldens = []
    this.selectedGolden = null
    this.presubmitTests = []
    this.selectedPresubmitTest = null
  }

  openDialog(): void {
    const dialogRef = this.dialog.open(DialogContentComponent, {
      maxWidth: '55vw'
    });

    dialogRef.afterClosed().subscribe(invocationID => {
      if (invocationID) {
        this.resetVariables()
        this.showLoaderBar()
        this.goldenService.getPresubmitTestArtifacts(invocationID)
          .pipe(finalize(() => this.hideLoaderBar()))
          .subscribe({
            next: (fetchedPresubmitTests) => {
              this.handlePresubmitSuccess(fetchedPresubmitTests as PresubmitTest[])
            },
            error: (err) => {
              this.showErrorAlert(err)
            }
          })
      }
    });
  }

  openCodeSearchDialog(): void {
    const dialogRef = this.dialog.open(CodeSearchDialogComponent, {
      maxWidth: '55vw'
    });

    dialogRef.afterClosed().subscribe(url => {
      if (url) {
        this.processCodesearchUrl(url);
      }
    });
  }

  private processCodesearchUrl(url: any) {
    this.testMode = TestModes.CODESEARCH
    this.resetVariables();
    console.log("showing loader")
    this.showLoaderBar();
    this.goldenService.fetchCodeSearchGoldens(url)
      .pipe(finalize(() => this.hideLoaderBar()))
      .subscribe({
        next: (goldens) => {
          console.log('AppComponent: Fetched CodeSearch goldens:', goldens);
          this.goldens = goldens;
          if (this.goldens.length > 0) {
            this.setSelectedGolden(this.goldens[0]);
          }
          this.cdr.detectChanges();
        },
        error: (err) => {
          console.error('AppComponent: Error fetching CodeSearch goldens:', err);
          this.snackBar.open('Error fetching CodeSearch goldens', 'Dismiss', { duration: 3000 });
        }
      });
  }

  openUserJsonDialog(): void {
    const dialogRef = this.dialog.open(UserJsonDialogComponent, {
      width: '90vw',
      height: '90vh',
      maxWidth: '95vw',
      maxHeight: '95vh'
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result && result.json) {
        try {
          const parsedData = JSON.parse(result.json);
          // Handle both top-level data and nested data (like CodeSearch response)
          let actualData: MotionGoldenData;
          if (parsedData.frame_ids && parsedData.features) {
            actualData = parsedData;
          } else if (parsedData.data && parsedData.data[0] && parsedData.data[0].frame_ids) {
            actualData = parsedData.data[0];
          } else {
            throw new Error("Invalid JSON format");
          }

          const goldenName = result.name || `User Content ${new Date().toLocaleString()}`;
          const userGolden: MotionGolden = {
            id: goldenName,
            label: goldenName,
            testMethodName: goldenName,
            testClassName: 'User',
            testTime: new Date().toISOString(),
            result: TestResult.Passed,
            dataSource: DataSource.USER,
            actualData: actualData,
            expectedData: actualData,
            actualUrl: '',
            expectedUrl: '',
            goldenRepoPath: '',
            videoUrl: undefined,
            goldenName: goldenName
          };

          this.goldens = [userGolden];
          this.testMode = TestModes.USER;
          this.setSelectedGolden(userGolden);
          console.log('AppComponent: Loaded User JSON golden:', userGolden);

        } catch (e) {
          console.error('AppComponent: Error parsing User JSON:', e);
          this.snackBar.open('Invalid JSON format', 'Dismiss', { duration: 3000 });
        }
      }
    });
  }

  clearAll(): void {
    this.resetVariables();
    this.testMode = "";
    const index = this.testModes.indexOf(TestModes.PRESUBMIT);
    if (index > -1) {
      this.testModes.splice(index, 1);
    }
    this.snackBar.open('Cleared all data', 'Dismiss', { duration: 2000 });
  }

  showProgress = false;
  testMode: string = "";
  showLoader = false;
  goldens: MotionGolden[] = [];
  presubmitTests: PresubmitTest[] = [];
  selectedPresubmitTest: PresubmitTest | null = null;
  selectedGolden: MotionGolden | null = null;
  showTestList: boolean = true;
  showCheckBoxes: boolean = false;
  showPreviewComponent: boolean = true;
  isRefreshing: boolean = false;

  get isVideoPresent(): boolean {
    return this.selectedGolden?.videoUrl != null;
  }

  toggleTestListVisibility() {
    this.showTestList = !this.showTestList;
  }

  showErrorAlert(err: Error) {
    alert(`Some error occurred ${err.message}`)
  }
  showLoaderBar(): void {
    this.showLoader = true;
  }

  hideLoaderBar(): void {
    this.showLoader = false;
  }


  ngDoCheck(): void {
    this.showProgress = this.progressTracker.isActive;
  }

  ngOnInit(): void {
    this.addGerritMainChangelistDataListener();
    this.subscribeToErrorService();
    this.checkCodesearchLink()
    this.checkGerritLinks()
    this.goldenService.getTestModes().subscribe((modes) => {
      this.testModes = this.testModes.concat(modes)
      if (this.testModes.length > 0 && this.testModes[0]
        && this.testModes[0] !== TestModes.GERRIT && this.testMode !== TestModes.CODESEARCH) { //set First TestMode As Default Mode
        // if it is not Gerrit or CS
        this.switchMode(this.testModes[0])
      }
      console.log(this.testModes)
    })
  }

  private checkCodesearchLink() {
    const searchParams = new URLSearchParams(window.location.search);
    const csLink = searchParams.get('csLink') ?? ""
    if (csLink) {
      this.processCodesearchUrl(csLink)
    }
  }

  private checkGerritLinks() {
    const searchParams = new URLSearchParams(window.location.search);
    const leftLink = searchParams.get('leftLink') ?? ""
    const rightLink = searchParams.get('rightLink') ?? ""
    if (leftLink || rightLink) {
      this.fetchGerritData(leftLink, rightLink)
    } else {
      console.log("GERRIT: left and right is null")
    }
  }

  private subscribeToErrorService() {
    this.errorSubscription = this.errorService.error$.subscribe(error => {
      const config: any = {
        horizontalPosition: 'left',
        verticalPosition: 'bottom',
      };
      if (error.displayDuration != null) {
        config.duration = error.displayDuration;
      }
      this.snackBar.open(error.message, undefined, config);
    });
  }

  onVerticalMouseDown(event: MouseEvent) {
    this.isVerticalResizing.set(true);
    this.initialMouseX.set(event.clientX);
    this.initialTestListPanelWidth.set(this.testListPanelWidth());
    const containerRect = this.appContainer.nativeElement.getBoundingClientRect();
    this.testListContainer.set(containerRect.left);
    event.preventDefault();
  }

  onHorizontalMouseDown(event: MouseEvent) {
    this.isHorizontalResizing.set(true);
    this.initialMouseY.set(event.clientY);
    this.initialVideoPanelHeight.set(this.videoPanelHeight());
    const containerRect = this.testDisplayPanelContainer.nativeElement.getBoundingClientRect();
    this.videoPanelContainer.set(containerRect.top);
    event.preventDefault();
  }

  @HostListener('document:mousemove', ['$event'])
  onMouseMove(event: MouseEvent) {
    if (this.isVerticalResizing()) {
      const deltaX = event.clientX - this.initialMouseX();
      const newWidth = this.initialTestListPanelWidth() + deltaX;
      const minW = this.appContainer
        .nativeElement.offsetWidth * TestListPanelDimensionsFactor.MIN_WIDTH;
      const maxW = this.appContainer
        .nativeElement.offsetWidth * TestListPanelDimensionsFactor.MAX_WIDTH;
      const constrainedWidth = Math.min(Math.max(newWidth, minW), maxW);
      this.testListPanelWidth.set(constrainedWidth);
    } else if (this.isHorizontalResizing()) {
      const deltaY = event.clientY - this.initialMouseY();
      const newHeight = this.initialVideoPanelHeight() + deltaY;
      const minH = this.testDisplayPanelContainer
        .nativeElement.offsetHeight * VideoPanelDimensionsFactor.MIN_HEIGHT;
      const maxH = this.testDisplayPanelContainer
        .nativeElement.offsetHeight * VideoPanelDimensionsFactor.MAX_HEIGHT;
      const constrainedHeight = Math.min(Math.max(newHeight, minH), maxH);
      this.videoPanelHeight.set(constrainedHeight);
    }
  }

  @HostListener('document:mouseup')
  onMouseUp() {
    this.isVerticalResizing.set(false);
    this.isHorizontalResizing.set(false);
  }

  private addGerritMainChangelistDataListener() {
    window.addEventListener("message", (event) => {
      if (event.origin !== window.location.origin) {
        return;
      }

      if (event.data && event.data.type === "FROM_CONTENT_SCRIPT") {
        console.log("Received dat via postMessage from gerrit extension content script:", event.data);

        const linkPairs: GerritLinkPair[] = event.data.payload as GerritLinkPair[];
        this.fetchMultipleJsonsFromGerrit(linkPairs);

      }
    });
  }

  fetchMultipleJsonsFromGerrit(linkPairs: GerritLinkPair[]) {
    this.testMode = TestModes.GERRIT
    this.goldens = []
    this.showLoaderBar()
    this.goldenService.fetchGerritGoldens(linkPairs)
      .pipe(finalize(() => this.hideLoaderBar()))
      .subscribe((goldens) => {
        this.goldens = goldens as MotionGolden[]
      })
    this.testModes.push(TestModes.GERRIT)

  }

  fetchGerritData(leftLink: string, rightLink: string) {
    this.testMode = TestModes.GERRIT
    this.showLoaderBar()
    this.goldenService
      .getGerritData(leftLink, rightLink)
      .pipe(finalize(() => this.hideLoaderBar()))
      .subscribe((goldens) => {
        this.goldens = goldens;
        if (this.goldens.length > 0) {
          this.setSelectedGolden(this.goldens[0]);
        }
      })
    this.testModes.push(TestModes.GERRIT)
  }

  refreshGoldens(clear: boolean): void {
    this.isRefreshing = true;
    this.progressTracker.beginProgress();
    this.goldenService
      .refreshGoldens(clear)
      .pipe(
        finalize(() => {
          this.isRefreshing = false;
          this.progressTracker.endProgress();
          this.selectedGolden = null;
          this.cdr.detectChanges();
        })
      )
      .subscribe({
        next: (goldens) => {
          this.goldens = goldens;
          this.snackBar.open('Refresh successful!', 'Dismiss', {
            duration: 3000,
            horizontalPosition: 'center',
            verticalPosition: 'bottom',
            panelClass: ['snackbar-success']
          });
        },
      });
  }

  setSelectedGolden(golden: MotionGolden): void {
    this.selectedGolden = golden;
    this.previewService.setShowMarker(this.showPreviewComponent && this.isVideoPresent);
  }

  setSelectedPresubmitTest(presubmitTest: PresubmitTest): void {
    this.selectedPresubmitTest = presubmitTest;
    this.showLoaderBar();
    this.goldenService.getPresubmitTestArtifactsForTestName(presubmitTest.testname)
      .pipe(finalize(() => this.hideLoaderBar())).subscribe({
        next: (fetchedGolden) => {
          this.selectedGolden = fetchedGolden
        },
        error: (err) => {
          this.goldens = [];
          this.selectedGolden = null;
          this.showErrorAlert(err)
        }
      })
  }

  toggleCheckBoxes(): void {
    this.showCheckBoxes = !this.showCheckBoxes;
  }
  openPreviewComponent(): void {
    this.showPreviewComponent = !this.showPreviewComponent;
    this.previewService.setShowMarker(this.showPreviewComponent && this.isVideoPresent);
  }
  ngOnDestroy() {
    if (this.errorSubscription) {
      this.errorSubscription.unsubscribe();
    }
  }
}
