import {render, screen, fireEvent, waitFor} from '@testing-library/react';
import CreatePage from './page';
jest.mock('@/components/home/TodayCard', () => ({ TodayCard: () => null })); // has its own test; keeps the fetch counts below about generation
const fetchMock = jest.fn();
beforeEach(()=>{global.fetch=fetchMock;fetchMock.mockReset()});
function submit(){fireEvent.change(screen.getByLabelText('Topic or campaign brief'),{target:{value:'A launch announcement'}});fireEvent.click(screen.getByRole('button',{name:'Generate review draft'}));}
function response(body: unknown,status=200){return {ok:status<400,status,json:async()=>body};}
it('rejects empty successful response without inventing a saved draft',async()=>{fetchMock.mockResolvedValue(response({data:{}}));render(<CreatePage/>);submit();expect(await screen.findByRole('alert')).toHaveTextContent('No draft text');expect(screen.queryByText('Draft created and queued for review.')).not.toBeInTheDocument()});
it('prevents duplicate generation while pending',async()=>{let finish:any;fetchMock.mockReturnValue(new Promise(r=>finish=r));render(<CreatePage/>);submit();const button=screen.getByRole('button',{name:'Generating…'});fireEvent.click(button);expect(fetchMock).toHaveBeenCalledTimes(1);finish(response({content:'Complete draft'}));await screen.findByText('Complete draft')});
it('shows recoverable English network error and keeps brief',async()=>{fetchMock.mockRejectedValue(new Error('connection lost'));render(<CreatePage/>);submit();expect(await screen.findByRole('alert')).toHaveTextContent('connection');expect(screen.getByLabelText('Topic or campaign brief')).toHaveValue('A launch announcement')});
it.each([401,403,429,503])('shows English recovery for status %s',async(status)=>{fetchMock.mockResolvedValue(response({message:'\u4e2d\u6587\u9519\u8bef'},status));render(<CreatePage/>);submit();expect(await screen.findByRole('alert')).not.toHaveTextContent('\u4e2d\u6587');if(status===401)expect(screen.getByRole('link',{name:'Sign in'})).toHaveAttribute('href','/login')});
it('preserves complete multiline text and all visual prompts',async()=>{const content='First paragraph\n\n'+ 'Long evidence line. '.repeat(500)+'\nEND OF DRAFT';fetchMock.mockResolvedValue(response({data:{content,visualPrompts:['first image','second image','third image','fourth image']}}));render(<CreatePage/>);submit();await waitFor(()=>expect(screen.getByTestId('draft-content').textContent).toBe(content));expect(screen.getByText('fourth image')).toBeInTheDocument();expect(screen.getByText(/not saved or published/)).toBeInTheDocument()});
it('retains previous draft when retry fails',async()=>{fetchMock.mockResolvedValueOnce(response({content:'First complete draft'})).mockResolvedValueOnce(response({},503));render(<CreatePage/>);submit();await screen.findByText('First complete draft');fireEvent.click(screen.getByRole('button',{name:'Generate review draft'}));await screen.findByRole('alert');expect(screen.getByText('First complete draft')).toBeInTheDocument()});
it('puts a mic on the brief and a speaker beside the draft, not inside the draft text', async () => {
  render(<CreatePage />);
  expect(screen.getByRole('button', { name: 'Voice input' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Voice input' }));
  expect(await screen.findByRole('status')).toHaveTextContent('not available in this browser');
  fetchMock.mockResolvedValue(response({ data: { content: 'Complete draft', visualPrompts: ['cover prompt'] } }));
  submit();
  await screen.findByText('Complete draft');
  expect(screen.getByTestId('draft-content').textContent).toBe('Complete draft');
  expect(screen.getAllByRole('button', { name: 'Read aloud' }).length).toBeGreaterThan(1);
});

// 2026-11-22: Global /create runs the same brief precheck and draft post-check as the China viral flow.
const blockedBody = (stage: string) => ({ success: false, error: { code: 'CONTENT_COMPLIANCE_BLOCKED', stage, message: stage === 'brief' ? 'This brief was not sent for generation. It matched pre-publish compliance rules: INTL-DISEASE-CLAIM.' : 'The generated draft was withheld.', compliance: { level: 'violation', hits: [{ ruleId: 'INTL-DISEASE-CLAIM', severity: 'block', reason: 'Claims to cure or treat a disease', matchedTerms: ['cures diabetes'] }] } } });
it('shows a blocked brief with the rule and matched terms, and no draft', async () => {
  fetchMock.mockResolvedValue(response(blockedBody('brief'), 400));
  render(<CreatePage />); submit();
  const alert = await screen.findByRole('alert', { name: 'Compliance check' });
  expect(alert).toHaveTextContent('Brief blocked by the compliance check');
  expect(alert).toHaveTextContent('INTL-DISEASE-CLAIM');
  expect(alert).toHaveTextContent('cures diabetes');
  expect(screen.queryByTestId('draft-content')).not.toBeInTheDocument();
  expect(screen.getByLabelText('Topic or campaign brief')).toHaveValue('A launch announcement');
});
it('shows a withheld draft as a draft-stage block', async () => {
  fetchMock.mockResolvedValue(response(blockedBody('draft'), 400));
  render(<CreatePage />); submit();
  expect(await screen.findByRole('alert', { name: 'Compliance check' })).toHaveTextContent('Draft withheld by the compliance check');
});
it('flags a review-level draft as needing human review with the rule list', async () => {
  fetchMock.mockResolvedValue(response({ data: { content: 'Complete draft', visualPrompts: [], compliance: { level: 'risk', needsHumanReview: true, notice: 'Needs human review: the brief or draft matched review rules INTL-GUARANTEED-RESULT (guaranteed).', hits: [{ ruleId: 'INTL-GUARANTEED-RESULT', severity: 'review', reason: 'Guaranteed outcome', matchedTerms: ['guaranteed'] }] } } }));
  render(<CreatePage />); submit();
  await screen.findByText('Complete draft');
  const panel = screen.getByRole('region', { name: 'Compliance check' });
  expect(panel).toHaveTextContent('Needs human review');
  expect(panel).toHaveTextContent('INTL-GUARANTEED-RESULT');
  expect(panel).toHaveTextContent('guaranteed');
});
